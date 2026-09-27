const { sanitizeHTML } = require("../security/dompurify");

/**
 * Sanitizes document content before it reaches
 * application logic.
 */
function sanitizeDocument(req, res, next) {
    if (
        req.body &&
        typeof req.body.content === "string"
    ) {
        req.body.content = sanitizeHTML(
            req.body.content
        );
    }

    next();
}

module.exports = sanitizeDocument;