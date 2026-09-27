import {
  describe,
  it,
  expect
} from "vitest";

import {
  JSDOM
} from "jsdom";

import createDOMPurify from "dompurify";

import securityModule from
  "../server/security/dompurify.js";

const window =
  new JSDOM("").window;

const DOMPurify =
  createDOMPurify(window);

const {
  sanitizeHTML
} = securityModule;

describe(
  "DOMPurify Security Tests",
  () => {

    it(
      "should remove script tags",
      () => {

        const dirtyHTML =
          '<p>Hello</p>' +
          '<script>alert("XSS")</script>';

        const cleanHTML =
          DOMPurify.sanitize(
            dirtyHTML
          );

        expect(cleanHTML)
          .not
          .toContain("<script>");

        expect(cleanHTML)
          .toContain(
            "<p>Hello</p>"
          );
      }
    );

    it(
      "should remove javascript URLs",
      () => {

        const dirtyHTML =
          '<a href="javascript:alert(1)">' +
          "Click me</a>";

        const cleanHTML =
          DOMPurify.sanitize(
            dirtyHTML
          );

        expect(cleanHTML)
          .not
          .toContain(
            "javascript:"
          );
      }
    );

    it(
      "should sanitize HTML using project function",
      () => {

        const dirtyHTML =
          '<h1>Hello</h1>' +
          '<img src="x" ' +
          'onerror="alert(1)">';

        const cleanHTML =
          sanitizeHTML(
            dirtyHTML
          );

        expect(cleanHTML)
          .not
          .toContain(
            "onerror"
          );

        expect(cleanHTML)
          .toContain(
            "<h1>Hello</h1>"
          );
      }
    );

  }
);