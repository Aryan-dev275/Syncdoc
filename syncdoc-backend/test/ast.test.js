// Unit tests for the document AST (tree ops, validation, traversal, AST -> HTML).
const assert = require("assert");
const ast = require("../src/services/ast");
const { parseMarkdownToBlocks } = require("../src/services/markdownParser");

let passed = 0;
const ok = (name) => console.log(`  ✓ ${name}`) || passed++;
const throws = (fn, re) => assert.throws(fn, re);

// --- build
const doc = ast.createDocument();
const h = ast.addNode(doc, doc.id, ast.createNode("heading", "Introduction", { level: 1 }));
const p1 = ast.addNode(doc, doc.id, ast.createNode("paragraph", "Hello world"));
const code = ast.addNode(doc, doc.id, ast.createNode("code", "const a = 1;", { language: "js" }));
assert.equal(doc.children.length, 3);
assert.equal(h.parentId, doc.id);
assert.ok(h.id.startsWith("node-"));
ok("create document and add nodes (ids + parentId set)");

assert.ok(ast.validateAST(doc).valid);
ok("fresh document validates");

// --- insert at index
const p0 = ast.addNode(doc, doc.id, ast.createNode("paragraph", "first!"), 0);
assert.equal(doc.children[0].id, p0.id);
throws(() => ast.addNode(doc, doc.id, ast.createNode("paragraph", "x"), 99), /Bad index/);
ok("insert at index, bad index rejected");

// --- nesting
const li = ast.addNode(doc, p1.id, ast.createNode("list-item", "nested item"));
assert.equal(li.parentId, p1.id);
assert.equal(ast.findNode(doc, li.id).parent.id, p1.id);
assert.ok(ast.validateAST(doc).valid);
ok("nested child node (parent/child link)");

// --- find / traverse
assert.equal(ast.findNode(doc, "nope"), null);
assert.equal(ast.findNode(doc, code.id).node.content, "const a = 1;");
const order = [];
ast.traverse(doc, (n, parent, depth) => { order.push(`${depth}:${n.type}`); });
assert.deepEqual(order, ["0:document", "1:paragraph", "1:heading", "1:paragraph", "2:list-item", "1:code"]);
assert.equal(ast.countNodes(doc), 6);
let visited = 0;
ast.traverse(doc, () => { visited++; return false; });
assert.equal(visited, 1);
ok("findNode, depth-first traverse, early stop, countNodes");

// --- update
ast.updateNode(doc, h.id, { content: "Intro v2", level: 2 });
assert.equal(h.content, "Intro v2");
throws(() => ast.updateNode(doc, h.id, { id: "hacked" }), /cannot be updated/);
throws(() => ast.updateNode(doc, h.id, { children: [] }), /cannot be updated/);
throws(() => ast.updateNode(doc, h.id, { type: "banana" }), /Unknown node type/);
throws(() => ast.updateNode(doc, "nope", { content: "x" }), /not found/);
throws(() => ast.updateNode(doc, doc.id, { content: "x" }), /root/);
ok("update node; protected fields / bad type / missing id rejected");

// --- duplicate ids / bad parent
throws(() => ast.addNode(doc, doc.id, { id: h.id, type: "paragraph", content: "dup" }), /Duplicate node id/);
throws(() => ast.addNode(doc, "nope", ast.createNode("paragraph", "x")), /Parent not found/);
throws(() => ast.addNode(doc, doc.id, { type: "banana", content: "x" }), /Unknown node type/);
ok("duplicate id, missing parent, unknown type rejected on add");

// --- move
ast.moveNode(doc, code.id, p1.id, 0);
assert.equal(ast.findNode(doc, code.id).parent.id, p1.id);
assert.equal(code.parentId, p1.id);
assert.ok(ast.validateAST(doc).valid);
throws(() => ast.moveNode(doc, p1.id, li.id), /descendant/);
throws(() => ast.moveNode(doc, doc.id, p1.id), /root/);
throws(() => ast.moveNode(doc, code.id, doc.id, 99), /Bad index/);
assert.equal(ast.findNode(doc, code.id).parent.id, p1.id); // failed move leaves tree intact
ok("move node; cycles, root move, bad index rejected (tree intact)");

// --- delete (subtree)
const before = ast.countNodes(doc);
ast.deleteNode(doc, p1.id); // p1 has li + code under it
assert.equal(ast.findNode(doc, li.id), null);
assert.equal(ast.findNode(doc, code.id), null);
assert.equal(ast.countNodes(doc), before - 3);
throws(() => ast.deleteNode(doc, doc.id), /root/);
throws(() => ast.deleteNode(doc, "nope"), /not found/);
ok("delete removes whole subtree; root/missing rejected");

// --- validation catches broken documents
const bad = JSON.parse(JSON.stringify(doc));
bad.children[0].parentId = "wrong";
assert.ok(ast.validateAST(bad).errors.some((e) => /parentId/.test(e)));
const dup = JSON.parse(JSON.stringify(doc));
dup.children[1].id = dup.children[0].id;
assert.ok(ast.validateAST(dup).errors.some((e) => /duplicate id/.test(e)));
const noId = JSON.parse(JSON.stringify(doc));
delete noId.children[0].id;
assert.ok(ast.validateAST(noId).errors.some((e) => /missing id/.test(e)));
const wrongRoot = { ...doc, type: "paragraph" };
assert.ok(ast.validateAST(wrongRoot).errors.some((e) => /Root type/.test(e)));
const badType = JSON.parse(JSON.stringify(doc));
badType.children[0].type = "banana";
assert.ok(ast.validateAST(badType).errors.some((e) => /unknown type/.test(e)));
const badKids = JSON.parse(JSON.stringify(doc));
badKids.children[0].children = "nope";
assert.ok(ast.validateAST(badKids).errors.some((e) => /children must be an array/.test(e)));
const badLevel = JSON.parse(JSON.stringify(doc));
badLevel.children[0].level = 9;
assert.ok(ast.validateAST(badLevel).errors.some((e) => /level/.test(e)));
const cyc = ast.createDocument([ast.createNode("paragraph", "loop")]);
cyc.children[0].children.push(cyc.children[0]);
assert.ok(ast.validateAST(cyc).errors.some((e) => /cycle/.test(e)));
assert.equal(ast.validateAST(null).valid, false);
assert.equal(ast.validateAST("string").valid, false);
ok("validator catches bad parentId, duplicate/missing id, bad root/type/children/level, cycles, non-objects");

// --- AST -> HTML
const d2 = ast.createDocument();
ast.addNode(d2, d2.id, ast.createNode("heading", "Title <script>alert(1)</script>", { level: 2 }));
ast.addNode(d2, d2.id, ast.createNode("paragraph", "line1\nline2"));
const para = ast.addNode(d2, d2.id, ast.createNode("paragraph", "with list"));
ast.addNode(d2, para.id, ast.createNode("list-item", "a"));
ast.addNode(d2, para.id, ast.createNode("list-item", "b"));
ast.addNode(d2, d2.id, ast.createNode("code", "x < y && y > z", { language: "js" }));
const html = ast.astToHTML(d2);
assert.ok(html.includes("<h2>Title &lt;script&gt;alert(1)&lt;/script&gt;</h2>"));
assert.ok(!html.includes("<script>"));
assert.ok(html.includes("<p>line1<br>line2</p>"));
assert.ok(html.includes("<ul><li>a</li><li>b</li></ul>"));
assert.ok(html.includes('<pre><code class="language-js">x &lt; y &amp;&amp; y &gt; z</code></pre>'));
ok("AST -> HTML: escapes text, renders headings/paragraphs/code/nested lists");

// --- markdown import <-> AST round trip
const blocks = parseMarkdownToBlocks("# Title\n\nSome text\n\n- item one\n- item two\n\n```js\nlet x = 1;\n```");
const fromMd = ast.fromBlocks(blocks);
assert.ok(ast.validateAST(fromMd).valid, ast.validateAST(fromMd).errors.join("; "));
assert.equal(fromMd.children.length, blocks.length);
const back = ast.toBlocks(fromMd);
assert.equal(back.length, blocks.length);
assert.ok(back.every((b, i) => b.order === i && b.parentId === null));
assert.ok(ast.astToHTML(fromMd).includes("<pre><code"));
ok("markdown blocks -> AST -> blocks round trip, still valid");

// --- JSON friendly (what gets stored in MongoDB)
const copy = JSON.parse(JSON.stringify(d2));
assert.ok(ast.validateAST(copy).valid);
assert.equal(ast.astToHTML(copy), html);
ok("survives JSON serialize/parse (safe to store in MongoDB)");

console.log(`\nAll ${passed} checks passed`);
