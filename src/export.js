import DOMPurify from "dompurify";

/**
 * Sanitizes HTML before exporting.
 */
function sanitizeForExport(html) {
    return DOMPurify.sanitize(html || "", {
        USE_PROFILES: {
            html: true
        }
    });
}

/**
 * Creates a complete HTML document.
 */
function createHTMLDocument(
    content,
    title = "SyncDoc Document"
) {
    const safeContent =
        sanitizeForExport(content);

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

/**
 * Downloads a sanitized HTML document.
 */
function downloadHTML(
    content,
    filename = "syncdoc-document.html",
    title = "SyncDoc Document"
) {
    const htmlDocument =
        createHTMLDocument(
            content,
            title
        );

    const blob = new Blob(
        [htmlDocument],
        {
            type: "text/html;charset=utf-8"
        }
    );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

export {
    sanitizeForExport,
    createHTMLDocument,
    downloadHTML
};