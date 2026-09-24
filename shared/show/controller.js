import { fadeAt } from "../../video/cycle.js";
export class ShowController {
  constructor(settings, now, sessionId) {
    this.now = now;
    this.sessionId = sessionId;
    this.settings = { ...settings };
    this.nextSettings = { ...settings };
    this.phase = "ready";
    this.round = 0;
    this.count = 0;
    this.pending = 0;
    this.seen = new Set();
    this.time = 0;
    this.at = now();
    this.duration = 0;
    this.holdElapsed = 0;
    this.seed = 1;
    this.births = [];
    this.fallback = false;
    this.reason = "";
    this.resumePhase = null;
    this.visualSerial = 0;
  }
  running() {
    return this.phase === "playing" || this.phase === "fading";
  }
  elapsed() {
    return this.running()
      ? Math.min(
          this.duration,
          Math.max(0, this.time + (this.now() - this.at) / 1000),
        )
      : this.time;
  }
  sceneTime() {
    return (
      Math.max(
        0,
        this.elapsed() - Math.max(0, this.duration - this.settings.fadeSeconds),
      ) + (this.phase === "hold" ? this.holdTime() : this.holdElapsed)
    );
  }
  holdTime() {
    return this.phase === "hold"
      ? Math.min(
          this.settings.holdSeconds,
          this.holdElapsed + (this.now() - this.at) / 1000,
        )
      : this.holdElapsed;
  }
  countJellies() {
    return Math.min(
      this.settings.maxJellies,
      Math.max(
        this.settings.minJellies,
        this.count * this.settings.jelliesPerTrigger,
      ),
    );
  }
  displayJellyCount() {
    return this.settings.jellyMode === "composition" ? this.settings.compositionJellies : this.countJellies();
  }
  syncBirths() {
    while (this.births.length < this.displayJellyCount())
      this.births.push(this.sceneTime());
  }
  begin(duration, seed) {
    this.settings = { ...this.nextSettings };
    this.duration = duration;
    this.time = 0;
    this.at = this.now();
    this.holdElapsed = 0;
    this.phase = "playing";
    this.round++;
    this.count = this.pending;
    this.pending = 0;
    this.seed = seed;
    this.births = Array(this.displayJellyCount()).fill(0);
    this.reason = "";
  }
  report(time) {
    if (!this.running() || !Number.isFinite(time)) return;
    this.time = Math.max(0, Math.min(time, this.duration));
    this.at = this.now();
    this.phase =
      fadeAt(this.time, this.duration, this.settings.fadeSeconds) > 0
        ? "fading"
        : "playing";
  }
  end() {
    if (!this.running()) return false;
    this.time = this.duration;
    this.holdElapsed = 0;
    this.at = this.now();
    this.phase = "hold";
    return true;
  }
  pause(reason = "운영자 일시정지") {
    if (this.phase === "paused") return;
    const phase = this.phase;
    this.time = this.elapsed();
    this.holdElapsed = this.holdTime();
    this.resumePhase = phase;
    this.phase = "paused";
    this.reason = reason;
    this.at = this.now();
  }
  resume() {
    if (this.phase !== "paused") return;
    this.phase = this.resumePhase || "ready";
    this.at = this.now();
    this.reason = "";
  }
  seek(time) {
    this.time = Math.max(0, Math.min(time, this.duration));
    this.at = this.now();
    this.holdElapsed = 0;
    if (this.phase === "paused") this.resumePhase = "playing";
    else this.phase = "playing";
  }
  accept(event) {
    if (
      !event ||
      event.sessionId !== this.sessionId ||
      typeof event.senderId !== "string" ||
      !event.senderId ||
      event.senderId.length > 100 ||
      !Number.isSafeInteger(event.sequence) ||
      event.sequence < 1 ||
      event.eventId !== `${event.senderId}:${event.sequence}` ||
      typeof event.phraseId !== "string" ||
      !event.phraseId ||
      event.phraseId.length > 100
    )
      return { valid: false, accepted: false };
    if (this.seen.has(event.eventId)) return { valid: true, accepted: false };
    this.seen.add(event.eventId);
    if (this.running()) {
      this.count++;
      this.syncBirths();
      this.visualSerial++;
    } else this.pending++;
    return { valid: true, accepted: true };
  }
  snapshot() {
    const time = this.elapsed(),
      holdTime = this.holdTime();
    const underlying = this.phase === "paused" ? this.resumePhase : this.phase;
    const fade = ["hold"].includes(underlying)
      ? 1
      : underlying === "ready"
        ? 0
        : fadeAt(time, this.duration, this.settings.fadeSeconds);
    return {
      sessionId: this.sessionId,
      phase: this.phase,
      round: this.round,
      count: this.count,
      pending: this.pending,
      time,
      at: this.now(),
      duration: this.duration,
      holdElapsed: holdTime,
      remaining: Math.max(0, this.settings.holdSeconds - holdTime),
      fade,
      sceneTime: this.sceneTime(),
      seed: this.seed,
      births: [...this.births],
      jellyCount: this.displayJellyCount(),
      fallback: this.fallback,
      reason: this.reason,
      settings: this.settings,
      visualSerial: this.visualSerial,
    };
  }
}
