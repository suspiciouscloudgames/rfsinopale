import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startMediaServer, parseRange } from "../desktop/main/media-server.mjs";
import { resolveDisplays } from "../desktop/main/displays.mjs";
test("local video serving supports seek, suffix, HEAD and rejects invalid ranges", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sea-server-"));
  const file = path.join(root, "film.mp4");
  await writeFile(file, "0123456789");
  const server = await startMediaServer({ root, media: { "/media/A": file } });
  try {
    const r = await fetch(server.origin + "/media/A", {
      headers: { Range: "bytes=2-5" },
    });
    assert.equal(r.status, 206);
    assert.equal(await r.text(), "2345");
    assert.equal(r.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(
      await (
        await fetch(server.origin + "/media/A", {
          headers: { Range: "bytes=-3" },
        })
      ).text(),
      "789",
    );
    assert.equal(
      (
        await fetch(server.origin + "/media/A", {
          headers: { Range: "bytes=10-" },
        })
      ).status,
      416,
    );
    const head = await fetch(server.origin + "/media/A", { method: "HEAD" });
    assert.equal(head.headers.get("content-length"), "10");
    assert.equal(await head.text(), "");
    assert.equal((await fetch(server.origin + "/.git/config")).status, 404);
    await mkdir(path.join(root, "desktop/renderer"), { recursive: true });
    await writeFile(path.join(root, "desktop/secret"), "secret");
    assert.notEqual(
      (await fetch(server.origin + "/desktop/renderer/..%2fsecret")).status,
      200,
    );
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
  assert.throws(() => parseRange("bytes=-0", 10));
  assert.throws(() => parseRange("bytes=3-1", 10));
});
test("display mapping requires distinct present IDs and preserves negative desktop bounds", () => {
  const displays = [
    { id: 4, bounds: { x: -1920, y: -1080 } },
    { id: 9, bounds: { x: 0, y: 0 } },
  ];
  assert.equal(resolveDisplays(displays, { A: "4", B: "9" }).A.bounds.y, -1080);
  assert.throws(() => resolveDisplays(displays, { A: 4, B: 4 }));
  assert.throws(() => resolveDisplays(displays, { A: 4, B: 8 }));
});

test("startup restores valid mappings and discovers exactly two outputs top to bottom", async () => {
  const { startupMapping } = await import("../desktop/main/displays.mjs");
  const displays = [
    { id: 20, bounds: { x: 0, y: 1080 } },
    { id: 10, bounds: { x: 0, y: 0 } },
  ];
  assert.deepEqual(startupMapping(displays, { A: null, B: null }), {
    A: "10",
    B: "20",
  });
  assert.deepEqual(startupMapping(displays, { A: "20", B: "10" }), {
    A: "20",
    B: "10",
  });
  assert.deepEqual(startupMapping(displays, { A: "999", B: "10" }), {
    A: "10",
    B: "20",
  });
  const three = [...displays, { id: 30, bounds: { x: 1920, y: 0 } }];
  assert.deepEqual(startupMapping(three, { A: "10", B: "20" }), {
    A: "10",
    B: "20",
  });
  assert.throws(() => startupMapping(three, { A: null, B: null }));
  assert.throws(() =>
    startupMapping(displays.slice(0, 1), { A: "10", B: "20" }),
  );
  const horizontal = [
    { id: 2, bounds: { x: 1920, y: 0 } },
    { id: 1, bounds: { x: 0, y: 0 } },
  ];
  assert.deepEqual(startupMapping(horizontal, {}), { A: "1", B: "2" });
});
