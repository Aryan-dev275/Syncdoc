/**
 * SyncDoc document AST
 *
 * The document is a tree of blocks instead of one giant string:
 *
 *   document
 *   ├── heading
 *   ├── paragraph
 *   └── code
 *
 * Every node: { id, type, content?, language?, level?, parentId, children: [] }
 * All functions work on plain JSON, so the tree can be stored in MongoDB as is.
 */
const crypto = require("crypto");

const ROOT_TYPE = "document";
const NODE_TYPES = ["heading", "paragraph", "code", "list-item"];
const UPDATABLE_FIELDS = ["type", "content", "language", "level"];

const newId = () => `node-${crypto.randomUUID()}`;

/* ---------- creating ---------- */

function createDocument(children = []) {
  const root = { id: newId(), type: ROOT_TYPE, parentId: null, children: [] };
  for (const child of children) addNode(root, root.id, child);
  return root;
}

function createNode(type, content = "", extra = {}) {
  if (!NODE_TYPES.includes(type)) throw new Error(`Unknown node type: ${type}`);
  const { id, children, ...rest } = extra;
  return { id: id || newId(), type, content: String(content), ...rest, parentId: null, children: children || [] };
}

/* ---------- traversing ---------- */

/** Depth-first, pre-order. visit(node, parent, depth). Return false to stop early. */
function traverse(root, visit) {
  let stopped = false;
  (function walk(node, parent, depth) {
    if (stopped) return;
    if (visit(node, parent, depth) === false) { stopped = true; return; }
    for (const child of node.children || []) walk(child, node, depth + 1);
  })(root, null, 0);
}

/** Returns { node, parent, index } or null. */
function findNode(root, id) {
  let found = null;
  traverse(root, (node, parent) => {
    if (node.id === id) {
      found = { node, parent, index: parent ? parent.children.indexOf(node) : -1 };
      return false;
    }
  });
  return found;
}

const countNodes = (root) => { let n = 0; traverse(root, () => { n++; }); return n; };

/* ---------- editing ---------- */

/** Add `node` under the node with id `parentId`. `index` defaults to the end. */
function addNode(root, parentId, node, index) {
  const parent = findNode(root, parentId);
  if (!parent) throw new Error(`Parent not found: ${parentId}`);
  if (!node || typeof node !== "object") throw new Error("Node must be an object");
  const fresh = { children: [], ...node };
  const existing = new Set();
  traverse(root, (n) => { existing.add(n.id); });
  traverse(fresh, (n) => {
    if (!n.id) n.id = newId();
    if (existing.has(n.id)) throw new Error(`Duplicate node id: ${n.id}`);
    existing.add(n.id);
    if (n !== fresh && !NODE_TYPES.includes(n.type)) throw new Error(`Unknown node type: ${n.type}`);
  });
  if (!NODE_TYPES.includes(fresh.type)) throw new Error(`Unknown node type: ${fresh.type}`);
  fresh.parentId = parent.node.id;
  setParentIds(fresh);
  const at = index === undefined ? parent.node.children.length : index;
  if (!Number.isInteger(at) || at < 0 || at > parent.node.children.length) throw new Error(`Bad index: ${index}`);
  parent.node.children.splice(at, 0, fresh);
  return fresh;
}

/** Update type / content / language / level. id, parentId and children can't be changed here. */
function updateNode(root, id, patch) {
  const hit = findNode(root, id);
  if (!hit) throw new Error(`Node not found: ${id}`);
  if (hit.node === root) throw new Error("Cannot update the document root");
  for (const key of Object.keys(patch || {})) {
    if (!UPDATABLE_FIELDS.includes(key)) throw new Error(`Field cannot be updated: ${key}`);
  }
  if (patch.type !== undefined && !NODE_TYPES.includes(patch.type)) throw new Error(`Unknown node type: ${patch.type}`);
  if (patch.content !== undefined) patch = { ...patch, content: String(patch.content) };
  Object.assign(hit.node, patch);
  return hit.node;
}

/** Removes the node and its whole subtree. Returns the removed node. */
function deleteNode(root, id) {
  const hit = findNode(root, id);
  if (!hit) throw new Error(`Node not found: ${id}`);
  if (!hit.parent) throw new Error("Cannot delete the document root");
  hit.parent.children.splice(hit.index, 1);
  return hit.node;
}

/** Move a node (with its subtree) under a new parent. */
function moveNode(root, id, newParentId, index) {
  const hit = findNode(root, id);
  if (!hit) throw new Error(`Node not found: ${id}`);
  if (!hit.parent) throw new Error("Cannot move the document root");
  if (findNode(hit.node, newParentId)) throw new Error("Cannot move a node into itself or its own descendant");
  const target = findNode(root, newParentId);
  if (!target) throw new Error(`Parent not found: ${newParentId}`);
  hit.parent.children.splice(hit.index, 1);
  const at = index === undefined ? target.node.children.length : index;
  if (!Number.isInteger(at) || at < 0 || at > target.node.children.length) {
    hit.parent.children.splice(hit.index, 0, hit.node); // put it back
    throw new Error(`Bad index: ${index}`);
  }
  hit.node.parentId = target.node.id;
  target.node.children.splice(at, 0, hit.node);
  return hit.node;
}

function setParentIds(node) {
  for (const child of node.children || []) {
    child.parentId = node.id;
    setParentIds(child);
  }
}

/* ---------- validating ---------- */

/** Returns { valid, errors: string[] }. Never throws on bad input. */
function validateAST(root) {
  const errors = [];
  if (!root || typeof root !== "object") return { valid: false, errors: ["Document must be an object"] };
  if (root.type !== ROOT_TYPE) errors.push(`Root type must be "${ROOT_TYPE}"`);

  const ids = new Set();
  const seen = new Set();
  (function check(node, parent, path) {
    if (!node || typeof node !== "object") { errors.push(`${path}: node must be an object`); return; }
    if (seen.has(node)) { errors.push(`${path}: cycle detected`); return; }
    seen.add(node);

    if (typeof node.id !== "string" || !node.id) errors.push(`${path}: missing id`);
    else if (ids.has(node.id)) errors.push(`${path}: duplicate id "${node.id}"`);
    else ids.add(node.id);

    if (parent) {
      if (!NODE_TYPES.includes(node.type)) errors.push(`${path}: unknown type "${node.type}"`);
      if (node.parentId !== parent.id) errors.push(`${path}: parentId "${node.parentId}" does not match parent "${parent.id}"`);
      if (node.content !== undefined && typeof node.content !== "string") errors.push(`${path}: content must be a string`);
      if (node.language !== undefined && node.type !== "code") errors.push(`${path}: only code nodes can have a language`);
      if (node.level !== undefined && (node.type !== "heading" || !Number.isInteger(node.level) || node.level < 1 || node.level > 6)) {
        errors.push(`${path}: level must be 1-6 and only on headings`);
      }
    }

    if (!Array.isArray(node.children)) { errors.push(`${path}: children must be an array`); return; }
    node.children.forEach((child, i) => check(child, node, `${path}.children[${i}]`));
  })(root, null, "document");

  return { valid: errors.length === 0, errors };
}

/* ---------- converting ---------- */

/** Flat block list (from markdown import / Yjs) -> document tree. */
function fromBlocks(blocks) {
  return createDocument(
    (blocks || []).map((b) => {
      const { children, parentId, order, ...rest } = b; // eslint-disable-line no-unused-vars
      return { ...rest, children: children || [] };
    })
  );
}

/** Document tree -> top-level block list (same shape the Mongoose model stores). */
function toBlocks(root) {
  return root.children.map((child, order) => ({ ...child, order, parentId: null }));
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** AST -> HTML string. Text is escaped; nested children are rendered too. */
function astToHTML(root) {
  const renderList = (nodes) => {
    const out = [];
    for (let i = 0; i < nodes.length; ) {
      if (nodes[i].type === "list-item") {
        const items = [];
        while (i < nodes.length && nodes[i].type === "list-item") items.push(renderNode(nodes[i++]));
        out.push(`<ul>${items.join("")}</ul>`);
      } else out.push(renderNode(nodes[i++]));
    }
    return out.join("\n");
  };
  const renderNode = (n) => {
    const kids = n.children && n.children.length ? renderList(n.children) : "";
    switch (n.type) {
      case "heading": {
        const level = Math.min(Math.max(Number(n.level) || 1, 1), 6);
        return `<h${level}>${esc(n.content)}</h${level}>${kids}`;
      }
      case "code": {
        const cls = n.language ? ` class="language-${esc(n.language).replace(/[^\w-]/g, "")}"` : "";
        return `<pre><code${cls}>${esc(n.content)}</code></pre>${kids}`;
      }
      case "list-item": return `<li>${esc(n.content)}${kids}</li>`;
      default: return `<p>${esc(n.content).replace(/\n/g, "<br>")}</p>${kids}`;
    }
  };
  return renderList(root.children || []);
}

module.exports = {
  ROOT_TYPE, NODE_TYPES,
  createDocument, createNode,
  traverse, findNode, countNodes,
  addNode, updateNode, deleteNode, moveNode,
  validateAST, fromBlocks, toBlocks, astToHTML,
};
