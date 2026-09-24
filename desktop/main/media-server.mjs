import http from "node:http";
import { createReadStream } from "node:fs";
import { stat, realpath } from "node:fs/promises";
import path from "node:path";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".jpeg": "image/jpeg",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || !size || (!match[1] && !match[2])) throw new Error("range");
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new Error("range");
  return { start, end };
}
export async function startMediaServer({ root, media, tabletRoot }) {
  const mounts = {
    "/desktop/renderer/": path.join(root, "desktop/renderer"),
    "/shared/": path.join(root, "shared"),
    "/video/": path.join(root, "video"),
    "/tablet/": tabletRoot,
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = media[pathname];
      if (!file) {
        const prefix = Object.keys(mounts).find((x) => pathname.startsWith(x));
        if (!prefix || !mounts[prefix]) {
          res.writeHead(404).end();
          return;
        }
        const base = await realpath(mounts[prefix]);
        file = await realpath(
          path.resolve(base, pathname.slice(prefix.length) || "index.html"),
        );
        if (!file.startsWith(base + path.sep)) {
          res.writeHead(403).end();
          return;
        }
      }
      const info = await stat(file);
      if (!info.isFile()) {
        res.writeHead(404).end();
        return;
      }
      let range;
      try {
        range = parseRange(req.headers.range, info.size);
      } catch {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
        return;
      }
      const headers = {
        "Content-Type":
          types[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      };
      if (pathname.startsWith("/desktop/"))
        headers["Content-Security-Policy"] =
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'";
      headers["Content-Length"] = range
        ? range.end - range.start + 1
        : info.size;
      if (range)
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${info.size}`;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = createReadStream(file, range || undefined);
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
