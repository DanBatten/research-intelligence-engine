import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ParsedDocument {
  fileName: string;
  content: string;
  mimeType: string;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export async function parseFile(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return { fileName, content: data.text, mimeType: "application/pdf" };
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return { fileName, content: result.value, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const XLSX = (await import("xlsx")).default;
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer);
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]!;
      return `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`;
    });
    return { fileName, content: sheets.join("\n\n"), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  if (ext === ".csv") {
    const XLSX = (await import("xlsx")).default;
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
    return { fileName, content: XLSX.utils.sheet_to_csv(sheet), mimeType: "text/csv" };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    const { parseImageToText } = await import("./vision.js");
    const content = await parseImageToText(filePath);
    return { fileName, content, mimeType: `image/${ext.slice(1).replace("jpg", "jpeg")}` };
  }

  if (ext === ".md" || ext === ".txt" || ext === "") {
    const content = await fs.readFile(filePath, "utf-8");
    return { fileName, content, mimeType: "text/plain" };
  }

  // Fallback: try to read as text
  const content = await fs.readFile(filePath, "utf-8");
  return { fileName, content, mimeType: "text/plain" };
}

export function combineDocuments(
  userMessage: string,
  docs: ParsedDocument[]
): string {
  let combined = "";
  if (userMessage.trim()) {
    combined += `=== USER MESSAGE ===\n${userMessage}\n\n`;
  }
  for (const doc of docs) {
    combined += `=== DOCUMENT: ${doc.fileName} ===\n${doc.content}\n\n`;
  }
  return combined;
}
