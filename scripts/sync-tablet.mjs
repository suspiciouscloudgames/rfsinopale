import { cp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  source = path.resolve(root, "../gamepoem"),
  target = path.join(root, "desktop/tablet");
const files = [
  "index.html",
  "app.js",
  "connection.js",
  "sentence-events.js",
  "content.js",
  "interaction.js",
  "effects.js",
  "style.css",
  "vendor/peerjs-ios14.min.js",
  "vendor/peerjs.LICENSE",
  "assets/ocean-aerial-loop.mp4",
  "assets/ocean-aerial-poster.jpg",
  "assets/CREDITS.md",
];
await mkdir(target, { recursive: true });
const manifest = { source: "../gamepoem", files: {} };
for (const file of files) {
  const bytes = await readFile(path.join(source, file));
  await mkdir(path.dirname(path.join(target, file)), { recursive: true });
  await cp(path.join(source, file), path.join(target, file));
  manifest.files[file] = createHash("sha256").update(bytes).digest("hex");
}
await writeFile(
  path.join(target, "snapshot.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Bundled ${files.length} Game Poem files; source unchanged.`);
