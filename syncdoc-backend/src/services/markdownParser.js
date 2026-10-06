/**
 * Parses Markdown string into block AST JSON objects.
 * Supports headings (#, ##, etc.), code blocks (```), list items (-), and paragraphs.
 *
 * @param {string} markdownText
 * @returns {Array<{ id: string, type: string, content: string, order: number, parentId: string|null, children: Array }>}
 */
function parseMarkdownToBlocks(markdownText) {
  if (typeof markdownText !== "string") return [];
  const lines = markdownText.split(/\r?\n/);
  const blocks = [];
  let blockIndex = 1;
  let inCodeBlock = false;
  let codeContent = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          id: `block-${Date.now().toString(36)}-${blockIndex++}`,
          type: "code",
          language: codeLang,
          content: codeContent.join("\n"),
          order: blocks.length,
          parentId: null,
          children: [],
        });
        inCodeBlock = false;
        codeContent = [];
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          id: `block-${Date.now().toString(36)}-${blockIndex++}`,
          type: "heading",
          content: match[2],
          order: blocks.length,
          parentId: null,
          children: [],
        });
        continue;
      }
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      blocks.push({
        id: `block-${Date.now().toString(36)}-${blockIndex++}`,
        type: "list-item",
        content: trimmed.replace(/^[-*+]\s+/, ""),
        order: blocks.length,
        parentId: null,
        children: [],
      });
      continue;
    }

    blocks.push({
      id: `block-${Date.now().toString(36)}-${blockIndex++}`,
      type: "paragraph",
      content: trimmed,
      order: blocks.length,
      parentId: null,
      children: [],
    });
  }

  return blocks;
}

module.exports = { parseMarkdownToBlocks };
