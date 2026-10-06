const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

/**
 * Renders document title and block AST into a PDF Buffer using pdf-lib.
 *
 * @param {string} title
 * @param {Array<{ id: string, type: string, content: string }>} blocks
 * @returns {Promise<Buffer>}
 */
async function generatePDFFromAST(title = "SyncDoc Document", blocks = []) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 page dimensions
  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  function checkPageSpace(requiredHeight) {
    if (y - requiredHeight < margin) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
  }

  // Draw Document Title
  const cleanTitle = String(title || "SyncDoc Document").replace(/[^\x20-\x7E]/g, "");
  checkPageSpace(40);
  page.drawText(cleanTitle, {
    x: margin,
    y: y - 24,
    size: 24,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.1, 0.2),
  });
  y -= 45;

  // Draw Blocks
  for (const block of blocks) {
    const rawContent = String(block.content || "").replace(/[\r\n]+/g, " ");
    const cleanText = rawContent.replace(/[^\x20-\x7E]/g, "");
    if (!cleanText.trim()) continue;

    if (block.type === "heading" || block.type === "h1" || block.type === "h2") {
      checkPageSpace(30);
      page.drawText(cleanText, {
        x: margin,
        y: y - 18,
        size: 18,
        font: fontHelveticaBold,
        color: rgb(0.15, 0.2, 0.35),
      });
      y -= 30;
    } else if (block.type === "code") {
      checkPageSpace(25);
      page.drawText(cleanText, {
        x: margin + 10,
        y: y - 14,
        size: 11,
        font: fontCourier,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 25;
    } else {
      checkPageSpace(20);
      page.drawText(cleanText, {
        x: margin,
        y: y - 14,
        size: 12,
        font: fontHelvetica,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 20;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { generatePDFFromAST };
