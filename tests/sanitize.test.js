import {
  describe,
  it,
  expect
} from "vitest";

const sanitizeDocument =
  require(
    "../server/middleware/sanitize"
  );

describe(
  "Sanitize Middleware Tests",
  () => {

    it(
      "should sanitize request body content",
      () => {

        const req = {
          body: {
            content:
              '<h1>Hello</h1>' +
              '<script>alert("XSS")</script>'
          }
        };

        const res = {};

        const next = () => {};

        sanitizeDocument(
          req,
          res,
          next
        );

        expect(
          req.body.content
        )
          .not
          .toContain(
            "<script>"
          );

        expect(
          req.body.content
        )
          .toContain(
            "<h1>Hello</h1>"
          );
      }
    );

    it(
      "should call next middleware",
      () => {

        const req = {
          body: {
            content:
              "<p>Hello</p>"
          }
        };

        const res = {};

        let nextCalled = false;

        const next = () => {
          nextCalled = true;
        };

        sanitizeDocument(
          req,
          res,
          next
        );

        expect(
          nextCalled
        ).toBe(true);
      }
    );

    it(
      "should not modify non-string content",
      () => {

        const req = {
          body: {
            content: 12345
          }
        };

        const res = {};

        let nextCalled = false;

        const next = () => {
          nextCalled = true;
        };

        sanitizeDocument(
          req,
          res,
          next
        );

        expect(
          req.body.content
        ).toBe(12345);

        expect(
          nextCalled
        ).toBe(true);
      }
    );

  }
);