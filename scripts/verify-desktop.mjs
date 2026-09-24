import { _electron as electron } from "playwright";
import { installationDefaults } from "../desktop/main/settings.mjs";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const root = path.resolve(import.meta.dirname, ".."),
  appRoot = process.env.SEA_VERIFY_APP_ROOT
    ? path.resolve(process.env.SEA_VERIFY_APP_ROOT)
    : root,
  dir = await mkdtemp(path.join(os.tmpdir(), "sea-verify-")),
  output = path.join(root, "output/playwright");
await mkdir(output, { recursive: true });
await writeFile(
  path.join(dir, "installation.json"),
  JSON.stringify({ ...installationDefaults, room: `verify-${process.pid}` }),
);
const env = { ...process.env, SEA_TEST_DATA: dir };
delete env.ELECTRON_RUN_AS_NODE;
async function until(check, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("조건 대기 시간 초과");
}
let app;
const errors = [],
  results = [];
try {
  app = await electron.launch({
    args: [appRoot, "--preview"],
    env,
    timeout: 60000,
  });
  const pages = new Map();
  async function discover() {
    for (const p of app.windows()) {
      const url = p.url();
      if (url.includes("operator.html")) pages.set("operator", p);
      if (url.includes("channel=A")) pages.set("A", p);
      if (url.includes("channel=B")) pages.set("B", p);
    }
  }
  const deadline = Date.now() + 45000;
  while (pages.size < 3 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    await discover();
  }
  assert.equal(pages.size, 3, "operator and two outputs");
  for (const [name, p] of pages)
    p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  const op = pages.get("operator"),
    a = pages.get("A"),
    b = pages.get("B");
  await until(async () => {
    const { state } = await op.evaluate(() => window.installation.bootstrap());
    return state.health.A?.ready && state.health.B?.ready;
  });
  const bootstrap = await op.evaluate(() => window.installation.bootstrap());
  console.log("READY", JSON.stringify(bootstrap.state.health));
  assert.ok(bootstrap.state.health.A.duration > 310);
  assert.ok(bootstrap.state.health.B.duration > 348);
  assert.equal(bootstrap.state.fallback, false);
  results.push("두 출력/실제 영상 메타데이터/GLB 로드 통과");
  await op.locator('[name="holdSeconds"]').fill("2");
  await op.locator("#settings button[type=submit]").click();
  await op.locator('[data-command="start"]').click();
  await a.waitForFunction(
    () =>
      Number(document.body.dataset.showTime) > 1 &&
      document.body.dataset.phase === "playing",
  );
  await b.waitForFunction(
    () => document.querySelector("#film").currentTime > 1,
  );
  const sample = await Promise.all(
    [a, b].map((p) =>
      p.evaluate(() => ({
        time: document.querySelector("#film").currentTime,
        muted: document.querySelector("#film").muted,
        owner: document.body.dataset.soundOwner,
      })),
    ),
  );
  assert.ok(
    Math.abs(sample[0].time - sample[1].time) < 0.4,
    JSON.stringify(sample),
  );
  assert.equal(sample[0].owner, "true");
  assert.equal(sample[1].owner, "false");
  results.push({ name: "두 영상 재생·단일 오디오 소유권", sample });
  await op.locator("summary").click();
  await op.locator('[data-command="trigger"]').click();
  await a.waitForFunction(() => document.body.dataset.triggerCount === "1");
  await b.waitForFunction(() => document.body.dataset.triggerCount === "1");
  await op.locator('[data-command="fade"]').click();
  await a.waitForFunction(() => document.body.dataset.phase === "fading");
  await b.waitForFunction(() => document.body.dataset.phase === "fading");
  await until(
    async () =>
      !(await op.evaluate(() => window.installation.bootstrap())).state.busy,
  );
  await a.screenshot({ path: path.join(output, "dual-A-fade.png") });
  await b.screenshot({ path: path.join(output, "dual-B-fade.png") });
  results.push("공통 페이드·트리거 1회 집계 통과");
  await op.locator('[data-command="pause"]').click();
  await a.waitForFunction(() => document.body.dataset.phase === "paused");
  const before = await a.evaluate(
    () => document.querySelector("#film").currentTime,
  );
  await new Promise((r) => setTimeout(r, 400));
  const after = await a.evaluate(
    () => document.querySelector("#film").currentTime,
  );
  assert.ok(Math.abs(after - before) < 0.04);
  await op.locator('[data-command="start"]').click();
  await a.waitForFunction(() => document.body.dataset.phase === "fading");
  await until(
    async () =>
      !(await op.evaluate(() => window.installation.bootstrap())).state.busy,
  );
  results.push("공통 일시정지·재개 통과");
  await op.locator('[data-command="end"]').click();
  await a.waitForFunction(
    () => document.body.dataset.phase === "hold",
    {},
    { timeout: 15000 },
  );
  await b.waitForFunction(() => document.body.dataset.phase === "hold");
  const held = await a.evaluate(() => ({
    fade: document.body.dataset.fade,
    count: document.querySelector("#world").dataset.visibleCount,
  }));
  assert.equal(held.fade, "1.00000");
  assert.equal(held.count, "1");
  await op.locator('[data-command="trigger"]').click();
  await a.waitForFunction(
    () =>
      document.body.dataset.round === "2" &&
      document.body.dataset.phase === "playing",
    {},
    { timeout: 20000 },
  );
  await b.waitForFunction(() => document.body.dataset.round === "2");
  assert.equal(
    await a.locator("#world").getAttribute("data-visible-count"),
    "0",
  );
  assert.equal(
    await b.locator("#world").getAttribute("data-visible-count"),
    "0",
  );
  assert.equal(
    (await op.evaluate(() => window.installation.bootstrap())).state.count,
    1,
  );
  results.push(
    "종료→공통 HOLD→다음 회차 / 이전 해파이 제거 / 대기 입력 이월 통과",
  );

  // Exercise the real Game Poem UI and its iframe/ack path in the same app session.
  const tabletCreated = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow }, url) => {
    const w = new BrowserWindow({
      width: 720,
      height: 1000,
      show: true,
      webPreferences: { backgroundThrottling: false },
    });
    w.loadURL(url);
  }, `${bootstrap.origin}/tablet/?room=verify-${process.pid}`);
  const tablet = await tabletCreated;
  await tablet.waitForLoadState("domcontentloaded");
  await tablet.locator("#begin").click();
  await tablet.locator(".fragment").first().focus();
  await tablet.locator(".fragment").first().press("Enter");
  await until(
    async () =>
      (await op.evaluate(() => window.installation.bootstrap())).state.count ===
      2,
  );
  await tablet.locator(".fragment").first().press("Enter");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(
    (await op.evaluate(() => window.installation.bootstrap())).state.count,
    2,
  );
  await tablet.locator(".fragment").first().press("Enter");
  await until(
    async () =>
      (await op.evaluate(() => window.installation.bootstrap())).state.count ===
      3,
  );
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(
    (await op.evaluate(() => window.installation.bootstrap())).state.count,
    3,
  );
  await tablet.close();
  results.push(
    "실제 Game Poem 문구 추가·제거·재추가 / iframe 전달·ack / 중복 없음 통과",
  );
  for (let i = 0; i < 15; i++)
    await op.evaluate(() => window.installation.command("trigger"));
  await op.evaluate(() => window.installation.command("seek", 286.3));
  await op.evaluate(() => window.installation.command("pause"));
  await a.waitForFunction(() => document.body.dataset.phase === "paused");
  await b.waitForFunction(() => document.body.dataset.phase === "paused");
  assert.equal(
    (await op.evaluate(() => window.installation.bootstrap())).state.jellyCount,
    16,
  );
  // Remove only the operator pause notice from the screenshot, leaving scene state intact.
  await a.locator("#notice").evaluate((el) => (el.style.visibility = "hidden"));
  await b.locator("#notice").evaluate((el) => (el.style.visibility = "hidden"));
  await a.screenshot({ path: path.join(output, "dual-A-jellies.png") });
  await b.screenshot({ path: path.join(output, "dual-B-jellies.png") });
  results.push("16개 해파이 공통 장면·상하 경계 스크린샷 저장");
  await op.evaluate(() => window.installation.command("start"));
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes("channel=B"),
    );
    w.webContents.forcefullyCrashRenderer();
  });
  await until(async () => {
    const s = (await op.evaluate(() => window.installation.bootstrap())).state;
    return s.phase === "paused" && s.health.B?.ready;
  });
  await op.evaluate(() => window.installation.command("start"));
  await until(async () =>
    ["playing", "fading"].includes(
      (await op.evaluate(() => window.installation.bootstrap())).state.phase,
    ),
  );
  results.push("아래 renderer 강제 종료 → 공통 정지 → 창 재생성 → 재개 통과");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(results, null, 2));
  await writeFile(
    path.join(output, "verification.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        platform: process.platform,
        appRoot,
        results,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  await rm(dir, { recursive: true, force: true });
}
