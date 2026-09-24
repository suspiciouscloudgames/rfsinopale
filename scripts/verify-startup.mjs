import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installationDefaults } from "../desktop/main/settings.mjs";
const root = path.resolve(import.meta.dirname, "..");
const results = [];
async function until(check) {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Startup timeout");
}
for (const scenario of ["fresh", "saved", "missing"]) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sea-startup-"));
  let app;
  try {
    await writeFile(
      path.join(dir, "installation.json"),
      JSON.stringify({
        ...installationDefaults,
        room: `startup-${process.pid}`,
        mapping:
          scenario === "saved" ? { A: "102", B: "101" } : { A: null, B: null },
      }),
    );
    const env = {
      ...process.env,
      SEA_TEST_DATA: dir,
      SEA_TEST_DISPLAY_COUNT: scenario === "missing" ? "1" : "2",
    };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      args: [path.join(root, "scripts/fixtures/startup-displays.cjs")],
      env,
    });
    let op;
    await until(async () => {
      op = app.windows().find((p) => p.url().includes("operator.html"));
      return op && (await op.evaluate(() => !!window.installation));
    });
    if (scenario === "missing") {
      await until(
        async () =>
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().some(
              (w) =>
                w.webContents.getURL().includes("operator.html") &&
                w.isVisible(),
            ),
          ),
      );
      const { state } = await op.evaluate(() =>
        window.installation.bootstrap(),
      );
      assert.equal(state.round, 0);
      assert.ok(state.message.includes("디스플레이"));
      results.push("디스플레이 부족: 자동 재생하지 않고 운영 화면 안내");
    } else {
      await until(async () => {
        const { state } = await op.evaluate(() =>
          window.installation.bootstrap(),
        );
        return !state.busy && state.round === 1 && state.time > 1;
      });
      const actual = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((w) => ({
          url: w.webContents.getURL(),
          visible: w.isVisible(),
          fullscreen: w.isFullScreen(),
        })),
      );
      assert.equal(
        actual.find((w) => w.url.includes("operator.html")).visible,
        false,
      );
      assert.equal(
        actual.filter(
          (w) => w.url.includes("output.html") && w.visible && w.fullscreen,
        ).length,
        2,
      );
      const { state } = await op.evaluate(() =>
        window.installation.bootstrap(),
      );
      assert.ok(state.health.A.time > 0 && state.health.B.time > 0);
      assert.deepEqual(
        state.config.mapping,
        scenario === "saved" ? { A: "102", B: "101" } : { A: "101", B: "102" },
      );
      assert.deepEqual(
        JSON.parse(await readFile(path.join(dir, "installation.json"), "utf8"))
          .mapping,
        state.config.mapping,
      );
      await new Promise((r) => setTimeout(r, 400));
      assert.equal(
        (await op.evaluate(() => window.installation.bootstrap())).state.round,
        1,
      );
      results.push(
        `${scenario}: 클릭 없이 화면 지정·전체화면 요청·두 영상 재생 / 운영 창 숨김 / 1회만 시작`,
      );
    }
  } finally {
    if (app) await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}
await mkdir(path.join(root, "output/playwright"), { recursive: true });
await writeFile(
  path.join(root, "output/playwright/startup-verification.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      platform: process.platform,
      nativeDisplays: "simulated",
      appRoot: process.env.SEA_VERIFY_APP_ROOT || root,
      results,
    },
    null,
    2,
  ),
);
console.log(results.join("\n"));
