import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";

/**
 * Downloads sanitized document content as PDF.
 */
async function downloadPDF(
    content,
    filename = "syncdoc-document.pdf",
    title = "SyncDoc Document"
) {
    const safeContent =
        DOMPurify.sanitize(
            content || "",
            {
                USE_PROFILES: {
                    html: true
                }
            }
        );

    const safeTitle = String(title)
        .replace(/[<>&"']/g, "");

    const container =
        document.createElement("div");

    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "800px";
    container.style.padding = "40px";
    container.style.background = "#ffffff";
    container.style.color = "#222222";
    container.style.fontFamily =
        "Arial, Helvetica, sans-serif";
    container.style.lineHeight = "1.6";

    container.innerHTML = `
        <h1>${safeTitle}</h1>
        <hr>
        <div>${safeContent}</div>
    `;

    document.body.appendChild(container);

    try {
        const canvas =
            await html2canvas(
                container,
                {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff"
                }
            );

        const imageData =
            canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;

        const contentWidth =
            pageWidth - margin * 2;

        const imageHeight =
            (canvas.height *
                contentWidth) /
            canvas.width;

        let heightLeft =
            imageHeight;

        let position = margin;

        pdf.addImage(
            imageData,
            "PNG",
            margin,
            position,
            contentWidth,
            imageHeight
        );

        heightLeft -=
            pageHeight -
            margin * 2;

        while (heightLeft > 0) {
            position =
                heightLeft -
                imageHeight +
                margin;

            pdf.addPage();

            pdf.addImage(
                imageData,
                "PNG",
                margin,
                position,
                contentWidth,
                imageHeight
            );

            heightLeft -=
                pageHeight -
                margin * 2;
        }

        pdf.save(filename);
    } finally {
        document.body.removeChild(
            container
        );
    }
}

export {
    downloadPDF
};