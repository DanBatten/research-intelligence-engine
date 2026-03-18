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
  const sep = url.includes("?") ? "&" : "?";
  return fetch(`${url}${sep}key=${config.GOOGLE_API_KEY}`);
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false`
  );
  const fields = encodeURIComponent("files(id,name,mimeType,size)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;

  const res = await driveGet(url);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        "Folder is not shared publicly. Please set sharing to 'Anyone with the link can view' and try again."
      );
    }
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { files: DriveFile[] };
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
        "File is not shared publicly. Please set sharing to 'Anyone with the link can view' and try again."
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
      throw new Error("File is not shared publicly");
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
