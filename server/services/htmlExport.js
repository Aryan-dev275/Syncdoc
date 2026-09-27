const { sanitizeHTML } = require("../security/dompurify");

/**
 * Creates a complete sanitized HTML document.
 *
 * @param {string} content
 * @param {string} title
 * @returns {string}
 */
function createHTMLDocument(
    content,
    title = "SyncDoc Document"
) {
    const safeContent = sanitizeHTML(
        content || ""
    );

    const safeTitle = String(title)
        .replace(/[<>&"']/g, "");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>${safeTitle}</title>

    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 40px auto;
            padding: 0 24px;
            color: #222;
            background: #fff;
        }

        h1,
        h2,
        h3 {
            line-height: 1.25;
        }

        img {
            max-width: 100%;
            height: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th,
        td {
            border: 1px solid #ccc;
            padding: 8px;
        }
    </style>
</head>

<body>
    ${safeContent}
</body>
</html>`;
}

module.exports = {
    createHTMLDocument
};