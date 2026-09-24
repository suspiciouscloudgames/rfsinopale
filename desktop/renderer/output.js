import { createPoemEnding } from "./poem-ending.js";
import { createWorld } from "./jellies.js";
import { createOverlays } from "/video/overlays.js";
import { createSoundtrack } from "/video/soundtrack.js";
import { createSubtitles } from "./subtitles.js";
import { mediaTime, mediaCorrection } from "/shared/show/scene.js";
import { fadeAt } from "/video/cycle.js";
const api = window.installation,
  boot = await api.bootstrap(),
  channel = boot.channel,
  video = document.querySelector("#film"),
  notice = document.querySelector("#notice");
document.body.dataset.channel = channel;
// Both windows sample a single background gradient, just like the shared camera.
const backdrop = document.createElement("div");
backdrop.id = "world-background";
Object.assign(backdrop.style, {
  position: "absolute",
  left: "0",
  width: "100%",
  height: `${(boot.view.fullHeight / boot.view.height) * 100}%`,
  top: `${(-boot.view.y / boot.view.height) * 100}%`,
  background: "linear-gradient(#102b36, #01080d)",
});
document.querySelector("#stage").prepend(backdrop);
video.style.objectFit = boot.fit;
video.loop = channel === "B";
video.src = "/media/" + channel;
const identity = document.querySelector("#identity");
identity.textContent = `${channel === "A" ? "위 A · 기존 영상" : "아래 B · 바닥 영상"}`;
let state = boot.state,
  offset = 0,
  bestRTT = Infinity,
  world,
  subtitles = () => {},
  prepared = false,
  playing = false,
  fps = 0,
  frames = 0,
  fpsStart = performance.now(),
  lastReport = 0,
  lastSync = 0,
  pendingSeek = false,
  lastRound = -1,
  playGeneration = 0;
const soundtrack = channel === "A" ? createSoundtrack() : null,
  overlays =
    channel === "A"
      ? createOverlays(document.querySelector("#trigger-overlays"), (message) =>
          api.report({ type: "overlay-status", message }),
        )
      : null;
async function syncClock() {
  const a = performance.now(),
    remote = await api.clock(),
    b = performance.now();
  if (b - a <= bestRTT + 2) {
    bestRTT = Math.min(bestRTT, b - a);
    offset = remote - (a + b) / 2;
  }
}
for (let i = 0; i < 5; i++) await syncClock();
setInterval(() => void syncClock(), 5000);
const centralNow = () => performance.now() + offset;
const showDuration = () => channel === 'A' ? Math.max(video.duration, subtitles.duration || 0) : video.duration;
const playbackRate = () => channel === 'A' ? video.duration / showDuration() : 1;
const showTime = () => channel === 'A' ? video.currentTime / playbackRate() : video.currentTime;
const poem = channel === 'A' ? createPoemEnding(document.querySelector('#interaction-layers'), boot.origin) : null;
function waitEvent(name, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      video.removeEventListener(name, done);
      video.removeEventListener("error", fail);
      error ? reject(error) : resolve();
    };
    const done = () => finish(),
      fail = () => finish(new Error(`${channel} 영상 로딩 실패`));
    const timer = setTimeout(
      () => finish(new Error(`${channel} ${name} 대기 시간 초과`)),
      timeout,
    );
    video.addEventListener(name, done, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
}
async function readyMedia() {
  if (video.readyState < 1) await waitEvent("loadedmetadata");
  if (!Number.isFinite(video.duration) || video.duration <= 0)
    throw new Error("영상 길이 오류");
  if (video.readyState < 2) await waitEvent("loadeddata");
  return { duration: showDuration() };
}
async function seek(time) {
  video.pause();
  const t = mediaTime(channel, channel === 'A' ? time * playbackRate() : time, video.duration);
  if (Math.abs(video.currentTime - t) > 0.001) {
    const pending = waitEvent("seeked");
    video.currentTime = t;
    await pending;
  }
  await readyMedia();
}
api.onState((next) => {
  state = next;
  if (world && next.fallback) world.fallback();
  video.style.objectFit = next.config.fit[channel];
  if (next.round !== lastRound) {
    lastRound = next.round;
    overlays?.clear();
  }
});
api.onRequest(async (name, data) => {
  if (name === "poem-ending") {
    if(!poem) return {token:null};
    overlays?.clear();
    document.body.classList.add('poem-ending');
    poem.progress(state.duration,state.duration,'ending',String(state.round));
    const result = await poem.finish();
    if(!result.token) document.body.classList.remove('poem-ending');
    return result;
  }
  if (name === "poem-blackout") {
    document.body.classList.add('poem-blackout'); return;
  }
  if (name === "poem-reset") { poem?.reset(data.token); return; }
  if (name === "prepare") {
    document.body.classList.remove('poem-ending');
    playGeneration++;
    playing = false;
    overlays?.clear();
    await soundtrack?.pause();
    await readyMedia();
    await seek(data.time);
    prepared = true;
    return { duration: showDuration() };
  }
  if (name === "play") {
    const generation = playGeneration;
    if (!prepared) throw new Error("준비되지 않은 출력");
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, data.startAt - centralNow())),
    );
    if (generation !== playGeneration) throw new Error("재생 취소");
    video.playbackRate = playbackRate();
    await Promise.all([video.play(), soundtrack?.start()]);
    document.body.classList.remove('poem-blackout');
    playing = true;
    overlays?.setPaused(false);
    return { time: showTime() };
  }
  if (name === "pause") {
    playGeneration++;
    playing = false;
    video.pause();
    overlays?.setPaused(true);
    if (state.phase !== "hold") await soundtrack?.pause();
    return;
  }
  if (name === "audio") {
    await soundtrack?.start();
    return;
  }
  if (name === "clear") {
    overlays?.clear();
    return;
  }
  if (name === "overlays") {
    for (let i = 0; i < data.count; i++)
      void overlays?.play({
        ...data.settings,
        triggerVideoUrl: "/desktop/renderer/trigger-videos.json",
      });
    return;
  }
  if (name === "reload") {
    playing = false;
    video.pause();
    await soundtrack?.pause();
    prepared = false;
    video.src = "/media/" + channel;
    video.load();
    await readyMedia();
    api.report({ type: "ready", duration: showDuration(), model: world.mode });
    return;
  }
  throw new Error("알 수 없는 출력 요청");
});
if (channel === "A") {
  const iframe = document.querySelector("#interaction-layers"),
    url = new URL("/tablet/", boot.origin);
  url.searchParams.set("display", "1");
  url.searchParams.set("room", boot.room);
  url.searchParams.set("screenSession", boot.sessionId);
  iframe.src = url.href;
  window.addEventListener("message", async (event) => {
    if (
      event.source !== iframe.contentWindow ||
      event.origin !== boot.origin ||
      event.data?.type !== "sentence-trigger" ||
      event.data.room !== boot.room
    )
      return;
    try {
      if (await api.trigger(event.data.event))
        iframe.contentWindow.postMessage(
          {
            type: "sentence-ack",
            sessionId: boot.sessionId,
            eventId: event.data.event.eventId,
          },
          boot.origin,
        );
    } catch {}
  });
} else document.querySelector("#interaction-layers").remove();
video.addEventListener("error", () =>
  api.report({ type: "fault", reason: "영상을 읽지 못했습니다." }),
);
video.addEventListener("ended", () => {
  playing = false;
  api.report({ type: "ended" });
});
try {
  const values = await Promise.all([
    createWorld(document.querySelector("#world"), boot.view, (reason) =>
      api.report({ type: "model-failed", reason }),
    ),
    readyMedia(),
    channel === "A"
      ? createSubtitles(document.querySelector("#subtitles"))
      : Promise.resolve(() => {}),
  ]);
  world = values[0];
  subtitles = values[2];
  if (state.fallback) world.fallback();
  api.report({ type: "ready", duration: showDuration(), model: world.mode });
} catch (error) {
  notice.textContent = error.message;
  api.report({ type: "fault", reason: error.message });
}
function frame(now) {
  frames++;
  if (now - fpsStart >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsStart));
    fpsStart = now;
    frames = 0;
  }
  const running = ["playing", "fading"].includes(state.phase),
    dt = running ? Math.max(0, (centralNow() - state.at) / 1000) : 0,
    time = Math.min(state.duration, state.time + dt),
    fade = running
      ? fadeAt(time, state.duration, state.settings.fadeSeconds)
      : state.fade;
  const sceneTime =
    state.sceneTime +
    (running || state.phase === "hold"
      ? Math.max(0, (centralNow() - state.at) / 1000)
      : 0);
  document.querySelector("#media-layer").style.opacity = String(1 - fade);
  world?.frame({
    count: state.jellyCount,
    fade,
    time: sceneTime,
    seed: state.seed,
    births: state.births,
    settings: state.settings,
  });
  subtitles(state.phase === "hold" ? -1 : showTime() * (subtitles.duration || showDuration()) / showDuration());
  overlays?.frame();
  document.body.dataset.phase = state.phase;
  document.body.dataset.round = String(state.round);
  document.body.dataset.showTime = time.toFixed(3);
  document.body.dataset.fade = fade.toFixed(5);
  document.body.dataset.triggerCount = String(state.count);
  document.body.dataset.soundOwner = String(channel === "A");
  identity.hidden = state.phase !== "ready";
  notice.hidden = state.phase !== "ready" && state.phase !== "paused";
  notice.textContent =
    state.phase === "paused"
      ? `일시정지\n${state.reason}`
      : `${channel === "A" ? "위 A" : "아래 B"} · 준비됨\n운영 화면에서 시작하세요`;
  // B follows A's common media clock. Avoid redundant seeks during a main-process barrier.
  if (
    channel === "B" &&
    running &&
    playing &&
    !state.busy &&
    now - lastSync > 500 &&
    !pendingSeek
  ) {
    lastSync = now;
    const correction = mediaCorrection(
      mediaTime("B", time, video.duration),
      video.currentTime,
      video.duration,
      true,
    );
    video.playbackRate = correction.rate;
    if (correction.seek) {
      pendingSeek = true;
      const done = () => {
        pendingSeek = false;
      };
      video.addEventListener("seeked", done, { once: true });
      video.currentTime = mediaTime("B", time, video.duration);
    }
  }
  if (now - lastReport > 200) {
    lastReport = now;
    if(!document.body.classList.contains('poem-ending')) poem?.progress(time, state.duration, running ? 'playing' : state.phase === 'hold' ? 'ending' : 'paused', String(state.round));
    api.report({
      type: "frame",
      time: showTime(),
      fps,
      dropped: video.getVideoPlaybackQuality?.().droppedVideoFrames || 0,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const name = {
    Enter: "start",
    KeyT: "trigger",
    KeyE: "fade",
    KeyO: "operator",
    KeyF: "fullscreen",
    Space: "pause",
    Escape: "windowed",
  }[event.code];
  if (name) {
    event.preventDefault();
    void api
      .command(name)
      .catch((error) => api.report({ type: "fault", reason: error.message }));
  }
});
