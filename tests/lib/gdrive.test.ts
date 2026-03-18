import { describe, it, expect } from "vitest";
import { extractDriveLinks } from "../../src/lib/gdrive.js";

describe("extractDriveLinks", () => {
  it("extracts folder ID from standard URL", () => {
    const text =
      "Check this out: https://drive.google.com/drive/folders/1AbC_dEf-GhIjKlMnOpQrStUvWxYz";
    const links = extractDriveLinks(text);
    expect(links).toEqual([
      { type: "folder", id: "1AbC_dEf-GhIjKlMnOpQrStUvWxYz" },
    ]);
  });

  it("extracts folder ID from URL with query params", () => {
    const text =
      "https://drive.google.com/drive/folders/1AbCdEf?usp=sharing";
    const links = extractDriveLinks(text);
    expect(links).toEqual([{ type: "folder", id: "1AbCdEf" }]);
  });

  it("extracts folder ID from URL with /u/0/ prefix", () => {
    const text =
      "https://drive.google.com/drive/u/0/folders/1AbCdEfGhI";
    const links = extractDriveLinks(text);
    expect(links).toEqual([{ type: "folder", id: "1AbCdEfGhI" }]);
  });

  it("extracts file ID from standard URL", () => {
    const text =
      "https://drive.google.com/file/d/1XyZ_aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing";
    const links = extractDriveLinks(text);
    expect(links).toEqual([
      { type: "file", id: "1XyZ_aBcDeFgHiJkLmNoPqRsTuVwXyZ" },
    ]);
  });

  it("extracts file ID from URL without trailing path", () => {
    const text =
      "https://drive.google.com/file/d/1XyZaBcDeF";
    const links = extractDriveLinks(text);
    expect(links).toEqual([{ type: "file", id: "1XyZaBcDeF" }]);
  });

  it("returns empty array for non-Drive URLs", () => {
    const text = "Check https://example.com and https://docs.google.com/forms/blah";
    const links = extractDriveLinks(text);
    expect(links).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractDriveLinks("")).toEqual([]);
  });

  it("handles multiple links in one message", () => {
    const text = [
      "Folder: https://drive.google.com/drive/folders/folderAAA",
      "File: https://drive.google.com/file/d/fileBBB/view",
      "Another folder: https://drive.google.com/drive/folders/folderCCC?usp=sharing",
    ].join("\n");
    const links = extractDriveLinks(text);
    expect(links).toEqual([
      { type: "folder", id: "folderAAA" },
      { type: "folder", id: "folderCCC" },
      { type: "file", id: "fileBBB" },
    ]);
  });

  it("deduplicates identical folder links", () => {
    const text = [
      "https://drive.google.com/drive/folders/sameFolderID",
      "https://drive.google.com/drive/folders/sameFolderID?usp=sharing",
    ].join(" ");
    const links = extractDriveLinks(text);
    expect(links).toEqual([{ type: "folder", id: "sameFolderID" }]);
  });

  it("deduplicates identical file links", () => {
    const text = [
      "https://drive.google.com/file/d/sameFileID/view",
      "https://drive.google.com/file/d/sameFileID",
    ].join(" ");
    const links = extractDriveLinks(text);
    expect(links).toEqual([{ type: "file", id: "sameFileID" }]);
  });

  it("extracts from Slack-formatted URLs (angle brackets)", () => {
    // Slack wraps URLs as <URL> or <URL|label> in event.text
    const text =
      "Here: <https://drive.google.com/drive/folders/slackFolder123> and <https://drive.google.com/file/d/slackFile456/view|My File>";
    const links = extractDriveLinks(text);
    expect(links).toEqual([
      { type: "folder", id: "slackFolder123" },
      { type: "file", id: "slackFile456" },
    ]);
  });

  it("deduplicates when same ID appears as both folder and file", () => {
    // Unlikely in practice but tests the shared seen-set
    const text = [
      "https://drive.google.com/drive/folders/sharedID",
      "https://drive.google.com/file/d/sharedID/view",
    ].join(" ");
    const links = extractDriveLinks(text);
    expect(links).toEqual([{ type: "folder", id: "sharedID" }]);
  });
});
