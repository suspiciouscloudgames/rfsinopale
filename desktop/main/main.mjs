import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  dialog,
  powerSaveBlocker,
  Menu,
} from "electron";
import path from "node:path";
import { randomUUID, randomInt } from "node:crypto";
import { appendFile, stat, readFile, writeFile } from "node:fs/promises";
import { startMediaServer } from "./media-server.mjs";
import { previewBounds, resolveDisplays, startupMapping } from "./displays.mjs";
import {
  readSettings,
  saveSettings,
  validateInstallation,
} from "./settings.mjs";
import { ShowController } from "../../shared/show/controller.js";
import { viewport } from "../../shared/show/scene.js";
const root = path.resolve(import.meta.dirname, "../.."),
  preview = process.argv.includes("--preview"),
  autoStart = !preview || process.argv.includes("--autostart");
if (process.env.SEA_TEST_DATA)
  app.setPath("userData", process.env.SEA_TEST_DATA);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else
  app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(null);
      const settingsFile = path.join(
        app.getPath("userData"),
        "installation.json",
      );
      let config = await readSettings(settingsFile);
      const logFile = path.join(app.getPath("userData"), "installation.log");
      const log = (event, data = {}) => {
        void appendFile(
          logFile,
          JSON.stringify({ at: new Date().toISOString(), event, ...data }) +
            "\n",
        ).catch(() => {});
      };
      const now = () => performance.now(),
        show = new ShowController(config.show, now, randomUUID());
      const media = {
        "/media/A":
          config.media.A ||
          path.join(
            root,
            "assets/video/resonant-field-film/resonant_field_picture_01.mp4",
          ),
        "/media/B":
          config.media.B || path.join(root, "assets/floorVideos/floor.mp4"),
        "/media/model": path.join(root, "animation/jellyfish_slow_swim.glb"),
        "/assets/audio/stuck-sea-loop.wav": path.join(
          root,
          "assets/audio/stuck-sea-loop.wav",
        ),
      };
      for (const file of [
        "resonant_field_subtitles.json",
        "resonant_field_subtitles_tr.json",
        "resonant_field_subtitles_en.json",
      ])
        media["/subtitles/" + file] = path.join(
          root,
          "assets/video/resonant-field-film",
          file,
        );
      for (const file of [
        "IMG_4869.mp4",
        "IMG_4886.mp4",
        "Untitled_1.mp4",
        "Untitled_2.mp4",
      ])
        media["/assets/tiggerVideos/web/" + file] = path.join(
          root,
          "assets/tiggerVideos/web",
          file,
        );
      const server = await startMediaServer({
        root,
        media,
        tabletRoot: path.join(root, "desktop/tablet"),
      });
      const windows = new Map(),
        roles = new Map(),
        health = new Map(),
        requests = new Map(),
        restartCounts = new Map();
      let startupPending = autoStart,
        startupFailed = false,
        startupTimer,
        playGeneration = 0,
        restartRequired = false,
        busy = false,
        quitting = false,
        requestId = 0,
        operator,
        message = "출력 준비 중",
        blocker = powerSaveBlocker.start("prevent-display-sleep"),
        lastTick = now();
      const publicDisplays = () =>
        screen.getAllDisplays().map((d) => ({
          id: String(d.id),
          label: d.label || `Display ${d.id}`,
          bounds: d.bounds,
          scaleFactor: d.scaleFactor,
          size: d.size,
        }));
      function state() {
        return {
          ...show.snapshot(),
          busy,
          message,
          health: Object.fromEntries(health),
          config,
          preview,
          displays: publicDisplays(),
        };
      }
      function broadcast() {
        const data = state();
        for (const w of windows.values())
          if (!w.isDestroyed()) w.webContents.send("sea:state", data);
        if (operator && !operator.isDestroyed())
          operator.webContents.send("sea:state", data);
      }
      function role(event) {
        const r = roles.get(event.sender.id);
        if (
          !r ||
          event.senderFrame !== event.sender.mainFrame ||
          !event.senderFrame.url.startsWith(
            server.origin + "/desktop/renderer/",
          )
        )
          throw new Error("허용되지 않은 요청");
        return r;
      }
      function rpc(channel, name, data = {}) {
        const w = windows.get(channel);
        if (!w || w.isDestroyed())
          return Promise.reject(new Error(`${channel} 출력 없음`));
        const id = ++requestId;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            requests.delete(id);
            reject(new Error(`${channel} ${name} 응답 시간 초과`));
          }, 20000);
          requests.set(id, {
            sender: w.webContents.id,
            resolve,
            reject,
            timer,
          });
          w.webContents.send("sea:request", { id, name, data });
        });
      }
      async function both(name, data) {
        return Promise.all(["A", "B"].map((c) => rpc(c, name, data)));
      }
      async function pause(reason) {
        playGeneration++;
        show.pause(reason);
        message = reason;
        broadcast();
        await Promise.all(
          ["A", "B"]
            .filter((c) => health.get(c)?.ready)
            .map((c) => rpc(c, "pause")),
        ).catch(() => {});
        log("pause", { reason });
      }
      async function transact(fn) {
        if (busy) throw new Error("다른 전환이 진행 중입니다.");
        busy = true;
        broadcast();
        try {
          return await fn();
        } catch (error) {
          await pause(error.message);
          throw error;
        } finally {
          busy = false;
          broadcast();
        }
      }
      async function playAt(time, newRound = false) {
        const generation = ++playGeneration;
        const metadata = await both("prepare", { time });
        if (generation !== playGeneration) throw new Error("전환 취소");
        const duration = metadata[0].duration;
        if (!Number.isFinite(duration) || duration <= 0)
          throw new Error("위 영상 길이를 읽지 못했습니다.");
        const startAt = now() + 250;
        const startPromises = both("play", { startAt }).then(
          () => null,
          (error) => error,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, startAt - now())),
        );
        if (generation !== playGeneration) throw new Error("전환 취소");
        for (const h of health.values()) h.lastProgress = now();
        if (newRound) show.begin(duration, randomInt(1, 10000000));
        else {
          show.seek(time);
          show.resume();
        }
        message = "상영 중";
        broadcast();
        const failure = await startPromises;
        if (failure) throw failure;
        if (generation !== playGeneration) throw new Error("전환 취소");
        if (newRound && show.count)
          await rpc("A", "overlays", {
            count: Math.min(show.count, show.settings.maxOverlays),
            settings: show.settings,
          });
        log("play", { round: show.round, time });
      }
      function startupFailure(reason) {
        if (!startupPending) return;
        startupPending = false;
        startupFailed = true;
        clearTimeout(startupTimer);
        message = `자동 시작을 완료하지 못했습니다: ${reason}`;
        operator.show();
        broadcast();
        log("auto-start-failed", { reason });
      }
      function maybeAutoStart() {
        if (!startupPending || busy || show.phase !== "ready") return;
        if (
          ["A", "B"].some(
            (c) =>
              !health.get(c)?.ready ||
              !windows.get(c)?.isVisible() ||
              (!preview && !windows.get(c)?.isFullScreen()),
          )
        )
          return;
        startupPending = false;
        clearTimeout(startupTimer);
        operator.hide();
        void start()
          .then(() => log("auto-start-complete"))
          .catch((error) => {
            startupFailed = true;
            message = `자동 시작 실패: ${error.message}`;
            operator.show();
            broadcast();
          });
      }
      async function start() {
        return transact(async () => {
          if (restartRequired)
            throw new Error("가져온 설정을 적용하려면 앱을 재시작하세요.");
          if (["A", "B"].some((c) => !health.get(c)?.ready))
            throw new Error("두 출력이 준비된 뒤 시작하세요.");
          if (show.phase === "paused" && show.resumePhase === "hold") {
            show.resume();
            await rpc("A", "audio");
            message = "해파이 유지";
            return;
          }
          if (
            show.phase === "ready" ||
            show.phase === "hold" ||
            (show.phase === "paused" && show.resumePhase === "ready")
          )
            await playAt(0, true);
          else if (show.phase === "paused") await playAt(show.time, false);
        });
      }
      function secure(w, r) {
        const contentsId = w.webContents.id;
        roles.set(contentsId, r);
        w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        w.webContents.on("will-navigate", (event) => event.preventDefault());
        w.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
          cb(false),
        );
        w.on("closed", () => roles.delete(contentsId));
      }
      function newOutput(channel, bounds, fullscreen) {
        const w = new BrowserWindow({
          ...bounds,
          useContentSize: preview,
          show: false,
          backgroundColor: "#000000",
          frame: preview,
          title: `Drifting Sea ${channel} ${channel === "A" ? "위" : "아래"}`,
          webPreferences: {
            preload: path.join(root, "desktop/preload/bridge.cjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            backgroundThrottling: false,
          },
        });
        windows.set(channel, w);
        secure(w, channel);
        health.set(channel, { ready: false });
        w.webContents.on("render-process-gone", (_e, details) => {
          void recover(channel, details.reason);
        });
        w.on("unresponsive", () => {
          void pause(`${channel} 출력 응답 없음`);
        });
        w.on("close", (event) => {
          if (!quitting) {
            event.preventDefault();
            void pause(`${channel} 출력 닫기 요청`);
            operator?.show();
          }
        });
        w.on("enter-full-screen", maybeAutoStart);
        w.once("ready-to-show", () => {
          w.show();
          if (fullscreen) w.setFullScreen(true);
          maybeAutoStart();
        });
        w.loadURL(
          `${server.origin}/desktop/renderer/output.html?channel=${channel}`,
        );
        return w;
      }
      async function recover(channel, reason) {
        if (quitting) return;
        health.set(channel, { ready: false });
        await pause(`${channel} 복구 필요: ${reason}`);
        const count = (restartCounts.get(channel) || 0) + 1;
        restartCounts.set(channel, count);
        if (count > 3) {
          message = `${channel} 자동 복구 3회 실패. 앱을 재시작하세요.`;
          broadcast();
          return;
        }
        const old = windows.get(channel),
          bounds =
            old?.getBounds() ||
            previewBounds(screen.getPrimaryDisplay())[channel];
        old?.destroy();
        newOutput(channel, bounds, !preview);
        log("renderer-recovery", { channel, count, reason });
      }
      function openOutputs() {
        let bounds,
          full = !preview;
        if (preview) bounds = previewBounds(screen.getPrimaryDisplay());
        else {
          try {
            const displays = resolveDisplays(
              screen.getAllDisplays(),
              config.mapping,
            );
            bounds = { A: displays.A.bounds, B: displays.B.bounds };
          } catch (error) {
            startupFailure(error.message);
            message = error.message;
            operator.show();
            broadcast();
            return;
          }
        }
        for (const channel of ["A", "B"]) {
          const existing = windows.get(channel);
          if (existing && !existing.isDestroyed()) {
            existing.setFullScreen(false);
            existing.setBounds(bounds[channel]);
            if (full) existing.setFullScreen(true);
          } else newOutput(channel, bounds[channel], full);
        }
      }
      operator = new BrowserWindow({
        show: !autoStart,
        width: 780,
        height: 900,
        title: "Drifting Sea · 2채널 운영",
        backgroundColor: "#081319",
        webPreferences: {
          preload: path.join(root, "desktop/preload/bridge.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      secure(operator, "operator");
      operator.on("close", (event) => {
        if (!quitting) {
          event.preventDefault();
          void pause("운영 창 닫힘");
          operator.minimize();
        }
      });
      operator.loadURL(server.origin + "/desktop/renderer/operator.html");
      ipcMain.handle("sea:bootstrap", (event) => {
        const channel = role(event);
        return {
          channel,
          origin: server.origin,
          sessionId: show.sessionId,
          room: config.room,
          view: viewport(channel, config.layout),
          fit: config.fit[channel] || "contain",
          state: state(),
        };
      });
      ipcMain.handle("sea:clock", (event) => {
        role(event);
        return now();
      });
      ipcMain.on("sea:reply", (event, data) => {
        const p = requests.get(data?.id);
        if (!p || p.sender !== event.sender.id) return;
        clearTimeout(p.timer);
        requests.delete(data.id);
        data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
      });
      ipcMain.on("sea:report", (event, data) => {
        let c;
        try {
          c = role(event);
        } catch {
          return;
        }
        if (!["A", "B"].includes(c) || !data || typeof data !== "object")
          return;
        const h = health.get(c) || {};
        h.lastSeen = now();
        if (data.type === "ready") {
          h.ready = true;
          h.duration = data.duration;
          h.model = data.model;
          if (data.model === "fallback") show.fallback = true;
          message = startupPending
            ? "두 출력 준비 후 자동 시작합니다."
            : "출력 준비 완료";
        }
        if (data.type === "frame" && Number.isFinite(data.time)) {
          h.time = data.time;
          h.fps = data.fps;
          h.dropped = data.dropped;
          if (h.lastTime !== data.time) {
            h.lastProgress = now();
            h.lastTime = data.time;
          }
          if (c === "A" && show.running() && !busy) show.report(data.time);
        }
        if (data.type === "ended" && c === "A" && !busy && show.end()) {
          void rpc("B", "pause");
          void rpc("A", "clear");
          message = "해파이 유지";
          broadcast();
        }
        if (data.type === "fault") {
          startupFailure(`${c}: ${String(data.reason).slice(0, 200)}`);
          void pause(`${c}: ${String(data.reason).slice(0, 200)}`);
        }
        if (data.type === "model-failed") {
          show.fallback = true;
          log("fallback", { channel: c, reason: String(data.reason) });
          broadcast();
        }
        health.set(c, h);
        maybeAutoStart();
      });
      ipcMain.handle("sea:trigger", async (event, trigger) => {
        if (role(event) !== "A")
          throw new Error("트리거 수신은 A만 허용됩니다.");
        const result = show.accept(trigger);
        if (result.accepted && show.running())
          void rpc("A", "overlays", {
            count: 1,
            settings: show.nextSettings,
          }).catch(() => {});
        broadcast();
        return result.valid;
      });
      ipcMain.handle("sea:command", async (event, name, data) => {
        const r = role(event),
          allowed = [
            "start",
            "pause",
            "fullscreen",
            "windowed",
            "operator",
            "trigger",
            "fade",
            "end",
          ];
        if (r !== "operator" && !allowed.includes(name))
          throw new Error("운영자 전용 명령입니다.");
        if (name === "start") return start();
        if (name === "pause") return pause("운영자 일시정지");
        if (name === "operator") {
          operator.show();
          return;
        }
        if (name === "fullscreen") {
          for (const w of windows.values()) w.setFullScreen(true);
          return;
        }
        if (name === "windowed") {
          for (const w of windows.values()) w.setFullScreen(false);
          return;
        }
        if (name === "trigger") {
          const n = ++requestId;
          const result = show.accept({
            sessionId: show.sessionId,
            senderId: "rehearsal",
            sequence: n,
            eventId: `rehearsal:${n}`,
            phraseId: "test",
          });
          if (result.accepted && show.running())
            await rpc("A", "overlays", {
              count: 1,
              settings: show.nextSettings,
            });
          broadcast();
          return;
        }
        if (name === "fade" || name === "end" || name === "seek")
          return transact(async () => {
            if (!show.round) throw new Error("상영을 먼저 시작하세요.");
            await pause("리허설 이동");
            if (
              name === "seek" &&
              (!Number.isFinite(data) || data < 0 || data >= show.duration)
            )
              throw new Error("영상 범위 안의 초를 입력하세요.");
            await playAt(
              name === "seek"
                ? data
                : name === "fade"
                  ? Math.max(0, show.duration - show.settings.fadeSeconds + 0.1)
                  : Math.max(0, show.duration - 2),
              false,
            );
          });
        if (name === "map") {
          if (show.running() || show.phase === "hold")
            throw new Error("화면 재배치는 먼저 일시정지하세요.");
          resolveDisplays(screen.getAllDisplays(), data);
          config = await saveSettings(settingsFile, {
            ...config,
            mapping: data,
          });
          openOutputs();
          broadcast();
          return;
        }
        if (name === "settings") {
          const candidate = validateInstallation({
            ...config,
            ...data,
            media: config.media,
            mapping: config.mapping,
          });
          if (
            candidate.room !== config.room ||
            JSON.stringify(candidate.layout) !== JSON.stringify(config.layout)
          )
            throw new Error(
              "room/논리 화면 변경은 설정 파일 저장 후 앱 재시작으로 적용하세요.",
            );
          config = await saveSettings(settingsFile, candidate);
          show.nextSettings = config.show;
          broadcast();
          return;
        }
        if (name === "select-media") {
          if (!["A", "B"].includes(data)) throw new Error("채널 오류");
          if (show.running() || show.phase === "hold")
            throw new Error("영상 교체는 먼저 일시정지하세요.");
          const result = await dialog.showOpenDialog(operator, {
            properties: ["openFile"],
            filters: [{ name: "MP4 영상", extensions: ["mp4"] }],
          });
          if (result.canceled) return;
          const file = result.filePaths[0];
          await stat(file);
          config = await saveSettings(settingsFile, {
            ...config,
            media: { ...config.media, [data]: file },
          });
          media["/media/" + data] = file;
          show.phase = "ready";
          show.resumePhase = null;
          show.time = 0;
          show.holdElapsed = 0;
          await both("reload");
          message = "영상 교체 완료. 시작 버튼으로 새 회차를 시작하세요.";
          broadcast();
          return;
        }
        if (name === "recover") {
          await pause("출력 재로딩 중");
          for (const c of ["A", "B"]) health.set(c, { ready: false });
          for (const w of windows.values()) if (!w.isDestroyed()) w.reload();
          broadcast();
          return;
        }
        if (name === "export-settings") {
          const result = await dialog.showSaveDialog(operator, {
            defaultPath: "drifting-sea-installation.json",
            filters: [{ name: "JSON", extensions: ["json"] }],
          });
          if (!result.canceled)
            await writeFile(result.filePath, JSON.stringify(config, null, 2));
          return;
        }
        if (name === "import-settings") {
          if (show.running() || show.phase === "hold")
            throw new Error("설정 가져오기는 먼저 일시정지하세요.");
          const result = await dialog.showOpenDialog(operator, {
            properties: ["openFile"],
            filters: [{ name: "JSON", extensions: ["json"] }],
          });
          if (result.canceled) return;
          const file = result.filePaths[0];
          if ((await stat(file)).size > 50000)
            throw new Error("설정 파일이 너무 큽니다.");
          const candidate = validateInstallation(
            JSON.parse(await readFile(file, "utf8")),
          );
          config = await saveSettings(settingsFile, candidate);
          restartRequired = true;
          message =
            "가져왔습니다. 앱을 종료 후 다시 실행하면 모든 설정이 적용됩니다.";
          broadcast();
          return;
        }
        if (name === "quit") {
          quitting = true;
          app.quit();
          return;
        }
        throw new Error("알 수 없는 명령");
      });
      for (const event of [
        "display-added",
        "display-removed",
        "display-metrics-changed",
      ])
        screen.on(event, () => {
          if (!preview)
            void pause(
              "디스플레이 구성이 바뀌었습니다. A/B를 다시 확인하고 적용하세요.",
            );
          broadcast();
        });
      const interval = setInterval(() => {
        const t = now();
        if (t - lastTick > 3000 && show.running())
          void pause("시스템 중단/절전 감지");
        lastTick = t;
        if (!busy && show.phase === "hold" && show.snapshot().remaining <= 0)
          void transact(() => playAt(0, true)).catch((error) =>
            log("restart-failed", { reason: error.message }),
          );
        if (!busy && show.running()) {
          for (const c of ["A", "B"]) {
            const h = health.get(c);
            if (h && t - (h.lastProgress || t) > 2500) {
              void pause(`${c} 영상 진행 중단. 연결/파일 확인 후 재개하세요.`);
              break;
            }
          }
        }
        broadcast();
      }, 100);
      app.on("second-instance", () => {
        operator.show();
        operator.focus();
      });
      app.on("before-quit", () => {
        quitting = true;
        clearInterval(interval);
        clearTimeout(startupTimer);
        if (powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
        void server.close();
      });
      app.on("activate", () => {
        if (!autoStart || startupFailed) operator.show();
      });
      if (!preview) {
        try {
          const mapping = startupMapping(
            screen.getAllDisplays(),
            config.mapping,
          );
          if (JSON.stringify(mapping) !== JSON.stringify(config.mapping))
            config = await saveSettings(settingsFile, { ...config, mapping });
        } catch (error) {
          startupFailure(error.message);
        }
      }
      if (startupPending)
        startupTimer = setTimeout(
          () =>
            startupFailure(
              "출력/영상 준비 시간 초과. 파일과 화면 연결을 확인하세요.",
            ),
          45000,
        );
      openOutputs();
      log("app-start", { preview });
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
