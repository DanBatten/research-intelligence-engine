import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { config } from "../config.js";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface DriveLink {
  type: "folder" | "file";
  id: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

export interface DownloadedFile {
  filePath: string;
  originalName: string;
}

export interface DownloadError {
  fileName: string;
  message: string;
}

export interface DriveDownloadResult {
  files: DownloadedFile[];
  truncated: boolean;
  errors: DownloadError[];
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

// ── URL Extraction ─────────────────────────────────────────────────────

const FOLDER_PATTERN =
  /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/g;
const FILE_PATTERN =
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/g;

export function extractDriveLinks(text: string): DriveLink[] {
  const seen = new Set<string>();
  const links: DriveLink[] = [];

  for (const match of text.matchAll(FOLDER_PATTERN)) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      links.push({ type: "folder", id });
    }
  }

  for (const match of text.matchAll(FILE_PATTERN)) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      links.push({ type: "file", id });
    }
  }

  return links;
}

// ── Service Account JWT Auth ───────────────────────────────────────────

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

function parseServiceAccountKey(): ServiceAccountKey {
  const raw = config.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");
  return JSON.parse(raw) as ServiceAccountKey;
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const sa = parseServiceAccountKey();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(sa.private_key, "base64url");

  const jwt = `${signInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  logger.info("Obtained Google Drive access token");
  return cachedToken.accessToken;
}

// ── REST helpers ───────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const WORKSPACE_EXPORT_MAP: Record<string, { mimeType: string; ext: string }> =
  {
    "application/vnd.google-apps.document": {
      mimeType: "application/pdf",
      ext: ".pdf",
    },
    "application/vnd.google-apps.spreadsheet": {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ext: ".xlsx",
    },
    "application/vnd.google-apps.presentation": {
      mimeType: "application/pdf",
      ext: ".pdf",
    },
  };

async function driveGet(url: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  // First verify the service account can see the folder itself
  const folderCheckUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`;
  const folderRes = await driveGet(folderCheckUrl);
  if (!folderRes.ok) {
    const body = await folderRes.text();
    logger.warn(
      { folderId, status: folderRes.status, body: body.slice(0, 300) },
      "Cannot access folder directly — sharing may not be set up"
    );
    throw new Error(
      `Cannot access folder (${folderRes.status}). Share the folder with the service account email as Viewer.`
    );
  }
  const folderMeta = await folderRes.json();
  logger.info({ folderId, folderName: (folderMeta as any).name }, "Folder access confirmed");

  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false`
  );
  const fields = encodeURIComponent("files(id,name,mimeType,size)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;

  const res = await driveGet(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }

  const text = await res.text();
  logger.info(
    { folderId, status: res.status, bodyPreview: text.slice(0, 300) },
    "Drive folder listing response"
  );
  const data = JSON.parse(text) as { files?: DriveFile[] };
  return data.files ?? [];
}

async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const fields = encodeURIComponent("id,name,mimeType,size");
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`;

  const res = await driveGet(url);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        "Cannot access file. Ensure the file is shared with the service account or 'Anyone with the link'."
      );
    }
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }

  return (await res.json()) as DriveFile;
}

export async function downloadDriveFile(
  file: DriveFile,
  destDir: string
): Promise<DownloadedFile> {
  // Check size for regular files
  if (file.size && Number(file.size) > MAX_FILE_SIZE) {
    throw new Error(
      `File exceeds 50 MB limit (${Math.round(Number(file.size) / 1024 / 1024)} MB)`
    );
  }

  const isWorkspace = file.mimeType.startsWith(
    "application/vnd.google-apps."
  );

  let res: Response;
  let destName: string;

  if (isWorkspace) {
    const exportInfo = WORKSPACE_EXPORT_MAP[file.mimeType];
    if (!exportInfo) {
      throw new Error(
        `Unsupported Google Workspace type: ${file.mimeType}`
      );
    }

    const url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportInfo.mimeType)}`;
    res = await driveGet(url);
    destName = file.name.replace(/\.[^.]+$/, "") + exportInfo.ext;
  } else {
    const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    res = await driveGet(url);
    destName = file.name;
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new Error("Cannot access file for download");
    }
    throw new Error(`Download failed (${res.status}): ${body}`);
  }

  // Handle filename collisions by appending file ID
  let destPath = path.join(destDir, destName);
  try {
    await fs.access(destPath);
    // File exists — append ID before extension
    const ext = path.extname(destName);
    const base = path.basename(destName, ext);
    destPath = path.join(destDir, `${base}_${file.id}${ext}`);
  } catch {
    // File doesn't exist — use original name
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);

  logger.info(
    { fileId: file.id, name: file.name, destPath },
    "Downloaded Drive file"
  );

  return { filePath: destPath, originalName: file.name };
}

// ── Orchestrator ───────────────────────────────────────────────────────

export async function downloadDriveLinks(
  links: DriveLink[],
  destDir: string
): Promise<DriveDownloadResult> {
  const files: DownloadedFile[] = [];
  const errors: DownloadError[] = [];
  let truncated = false;

  // Expand folders into file lists, resolve single files
  const allFiles: DriveFile[] = [];

  for (const link of links) {
    try {
      if (link.type === "folder") {
        const folderFiles = await listFolderFiles(link.id);
        allFiles.push(...folderFiles);
      } else {
        const meta = await getFileMetadata(link.id);
        allFiles.push(meta);
      }
    } catch (err) {
      errors.push({
        fileName: `${link.type}:${link.id}`,
        message: (err as Error).message,
      });
    }
  }

  // Cap total files
  if (allFiles.length > config.GDRIVE_MAX_FILES) {
    truncated = true;
    allFiles.length = config.GDRIVE_MAX_FILES;
  }

  // Download sequentially to avoid rate limits
  for (const file of allFiles) {
    try {
      const result = await downloadDriveFile(file, destDir);
      files.push(result);
    } catch (err) {
      logger.warn(
        { fileId: file.id, name: file.name, error: (err as Error).message },
        "Failed to download Drive file, skipping"
      );
      errors.push({
        fileName: file.name,
        message: (err as Error).message,
      });
    }
  }

  return { files, truncated, errors };
}
