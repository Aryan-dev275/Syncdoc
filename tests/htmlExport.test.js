import {
  describe,
  it,
  expect
} from "vitest";

const {
  createHTMLDocument
} = require(
  "../server/services/htmlExport"
);

describe(
  "HTML Export Tests",
  () => {

    it(
      "should create a valid HTML document",
      () => {

        const content =
          "<h1>SyncDoc Test</h1>" +
          "<p>Hello world</p>";

        const result =
          createHTMLDocument(
            content,
            "Test Document"
          );

        expect(result)
          .toContain(
            "<!DOCTYPE html>"
          );

        expect(result)
          .toContain("<html");

        expect(result)
          .toContain("<head>");

        expect(result)
          .toContain("<body>");

        expect(result)
          .toContain(
            "<h1>SyncDoc Test</h1>"
          );

        expect(result)
          .toContain(
            "<p>Hello world</p>"
          );
      }
    );

    it(
      "should remove script tags",
      () => {

        const maliciousContent =
          '<h1>Hello</h1>' +
          '<script>alert("XSS")</script>';

        const result =
          createHTMLDocument(
            maliciousContent,
            "Security Test"
          );

        expect(result)
          .not
          .toContain(
            "<script>"
          );

        expect(result)
          .not
          .toContain(
            'alert("XSS")'
          );

        expect(result)
          .toContain(
            "<h1>Hello</h1>"
          );
      }
    );

    it(
      "should remove dangerous event handlers",
      () => {

        const maliciousContent =
          '<img src="test.jpg" ' +
          'onerror="alert(1)">';

        const result =
          createHTMLDocument(
            maliciousContent,
            "Security Test"
          );

        expect(result)
          .not
          .toContain(
            "onerror"
          );

        expect(result)
          .not
          .toContain(
            "alert(1)"
          );
      }
    );

    it(
      "should include document title",
      () => {

        const result =
          createHTMLDocument(
            "<p>Test content</p>",
            "My SyncDoc File"
          );

        expect(result)
          .toContain(
            "<title>My SyncDoc File</title>"
          );
      }
    );

    it(
      "should handle empty document",
      () => {

        const result =
          createHTMLDocument(
            "",
            "Empty Document"
          );

        expect(result)
          .toContain(
            "<!DOCTYPE html>"
          );

        expect(result)
          .toContain(
            "<body>"
          );

        expect(result)
          .toContain(
            "</body>"
          );
      }
    );

  }
);