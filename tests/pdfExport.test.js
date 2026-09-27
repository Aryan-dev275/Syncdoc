/**
 * @vitest-environment jsdom
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from "vitest";

const {
  mockAddImage,
  mockAddPage,
  mockSave
} = vi.hoisted(() => ({
  mockAddImage: vi.fn(),
  mockAddPage: vi.fn(),
  mockSave: vi.fn()
}));

vi.mock("jspdf", () => ({
  jsPDF: class {

    addImage(...args) {
      mockAddImage(...args);
    }

    addPage(...args) {
      mockAddPage(...args);
    }

    save(...args) {
      mockSave(...args);
    }

  }
}));

vi.mock("html2canvas", () => ({
  default: vi.fn(
    async () => ({
      width: 800,
      height: 5000,

      toDataURL: vi.fn(
        () =>
          "data:image/png;base64,test"
      )
    })
  )
}));

import {
  downloadPDF
} from "../src/pdfExport.js";

import html2canvas
  from "html2canvas";

describe(
  "PDF Export Tests",
  () => {

    beforeEach(() => {

      vi.clearAllMocks();

      document.body.innerHTML =
        "";

    });

    it(
      "should generate and save a PDF",
      async () => {

        const content =
          "<h1>SyncDoc Test</h1>" +
          "<p>Hello world</p>";

        await downloadPDF(
          content,
          "test-document.pdf",
          "Test Document"
        );

        expect(
          html2canvas
        ).toHaveBeenCalled();

        expect(
          mockSave
        ).toHaveBeenCalledWith(
          "test-document.pdf"
        );
      }
    );

    it(
      "should sanitize malicious HTML",
      async () => {

        const maliciousContent =
          '<h1>Hello</h1>' +
          '<script>alert("XSS")</script>';

        await downloadPDF(
          maliciousContent,
          "security-test.pdf",
          "Security Test"
        );

        expect(
          mockSave
        ).toHaveBeenCalledWith(
          "security-test.pdf"
        );

        expect(
          mockAddImage
        ).toHaveBeenCalled();

      }
    );

    it(
      "should create a PDF page",
      async () => {

        const content =
          "<h1>SyncDoc</h1>" +
          "<p>PDF content test</p>";

        await downloadPDF(
          content,
          "page-test.pdf",
          "Page Test"
        );

        expect(
          mockAddImage
        ).toHaveBeenCalled();

        expect(
          mockSave
        ).toHaveBeenCalled();

      }
    );

    it(
      "should support multi-page PDF generation",
      async () => {

        const content = `
          <h1>
            Long SyncDoc Document
          </h1>

          <p>
            ${
              "Document content "
                .repeat(1000)
            }
          </p>
        `;

        await downloadPDF(
          content,
          "long-document.pdf",
          "Long Document"
        );

        expect(
          mockAddImage
        ).toHaveBeenCalled();

        expect(
          mockAddPage
        ).toHaveBeenCalled();

        expect(
          mockSave
        ).toHaveBeenCalledWith(
          "long-document.pdf"
        );

      }
    );

  }
);