import { describe, it, expect } from "vitest";
import { combineDocuments } from "../../src/parsers/index.js";

describe("combineDocuments", () => {
  it("combines user message and documents", () => {
    const result = combineDocuments("Hello world", [
      { fileName: "doc1.pdf", content: "PDF content", mimeType: "application/pdf" },
      { fileName: "doc2.txt", content: "Text content", mimeType: "text/plain" },
    ]);

    expect(result).toContain("=== USER MESSAGE ===");
    expect(result).toContain("Hello world");
    expect(result).toContain("=== DOCUMENT: doc1.pdf ===");
    expect(result).toContain("PDF content");
    expect(result).toContain("=== DOCUMENT: doc2.txt ===");
    expect(result).toContain("Text content");
  });

  it("skips empty user message", () => {
    const result = combineDocuments("  ", [
      { fileName: "doc.txt", content: "Content", mimeType: "text/plain" },
    ]);

    expect(result).not.toContain("USER MESSAGE");
    expect(result).toContain("=== DOCUMENT: doc.txt ===");
  });

  it("handles no documents", () => {
    const result = combineDocuments("Just a message", []);
    expect(result).toContain("=== USER MESSAGE ===");
    expect(result).toContain("Just a message");
  });
});
