import serverless from "serverless-http";

import { createServer } from "../../server";

// Netlify's Lambda-compatible runtime, combined with Express 5 +
// serverless-http, has been observed to leave req.body empty even
// when the client sends a well-formed JSON body (symptom: "All
// login fields are required" despite filled fields — see
// server/routes/auth.ts). Rather than rely on express.json() to
// parse the body correctly inside that stack, we parse the raw
// Lambda event body ourselves — decoding base64 if present — and
// hand the already-parsed object to Express via serverless-http's
// `request` hook, which runs before routing. This removes any
// dependency on how Express/body-parser happens to read the
// request stream in this specific runtime.
function parseEventBody(event: any): any {
  if (!event || typeof event.body !== "string" || event.body.length === 0) {
    return undefined;
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    // Not JSON (e.g. form-encoded) — let Express's own parsers handle it.
    return undefined;
  }
}

const server = serverless(createServer(), {
  request(req: any, event: any) {
    const parsed = parseEventBody(event);
    if (parsed !== undefined) {
      req.body = parsed;
    }
  },
});

export const handler = async (event: any, context: any) => {
  return server(event, context);
};
