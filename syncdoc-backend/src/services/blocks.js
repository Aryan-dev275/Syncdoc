const Y = require("yjs");

/**
 * Document model (matches the frontend's block editor):
 *   ydoc.getArray("blocks")  -> [{ id, type: "heading"|"paragraph"|"code", language? }]
 *   ydoc.getText(<blockId>)  -> the text of each block (realtime-editable)
 * If "blocks" is empty, falls back to any Y.Text found in the doc (Uday's demo model).
 */
function readBlocks(ydoc) {
  const order = ydoc.getArray("blocks").toArray();
  if (order.length) {
    return order.map((b) => ({ ...b, content: ydoc.getText(b.id).toString() }));
  }
  const out = [];
  ydoc.share.forEach((type, name) => {
    if (type instanceof Y.Text && type.length) {
      out.push({ id: name, type: "paragraph", content: type.toString() });
    }
  });
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Blocks -> HTML string (text is escaped; the export service sanitizes again). */
function blocksToHTML(blocks) {
  return blocks.map((b) => {
    const t = esc(b.content);
    if (b.type === "heading") return `<h1>${t}</h1>`;
    if (b.type === "code") return `<pre><code>${t}</code></pre>`;
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
}

module.exports = { readBlocks, blocksToHTML };
