const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitizes HTML content using DOMPurify.
 *
 * @param {string} html
 * @returns {string}
 */
function sanitizeHTML(html) {
    if (typeof html !== "string") {
        return "";
    }

    return DOMPurify.sanitize(html, {
        USE_PROFILES: {
            html: true
        }
    });
}

module.exports = {
    sanitizeHTML
};