import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const requested = decodeURIComponent(url.pathname);
    const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(root, normalized);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    if (requested === "/" || !existsSync(filePath)) {
      filePath = path.join(root, "index.html");
    }

    const data = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(data);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`BeeBill server running at http://127.0.0.1:${port}`);
});
