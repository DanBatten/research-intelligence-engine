import { describe, it, expect } from "vitest";
import { markdownToBlocks } from "../../src/integrations/notion/blocks.js";

describe("markdownToBlocks", () => {
  it("converts headings", () => {
    const blocks = markdownToBlocks("# H1\n## H2\n### H3");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toHaveProperty("type", "heading_1");
    expect(blocks[1]).toHaveProperty("type", "heading_2");
    expect(blocks[2]).toHaveProperty("type", "heading_3");
  });

  it("converts list items", () => {
    const blocks = markdownToBlocks("- bullet 1\n- bullet 2\n1. numbered");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toHaveProperty("type", "bulleted_list_item");
    expect(blocks[1]).toHaveProperty("type", "bulleted_list_item");
    expect(blocks[2]).toHaveProperty("type", "numbered_list_item");
  });

  it("converts dividers", () => {
    const blocks = markdownToBlocks("text\n---\nmore text");
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toHaveProperty("type", "divider");
  });

  it("treats plain text as paragraphs", () => {
    const blocks = markdownToBlocks("Just some text");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveProperty("type", "paragraph");
  });

  it("skips empty lines", () => {
    const blocks = markdownToBlocks("line 1\n\n\nline 2");
    expect(blocks).toHaveLength(2);
  });
});
