import test from "node:test";
import assert from "node:assert/strict";
import { ShowController } from "../shared/show/controller.js";
import { DEFAULTS } from "../video/config.js";
const setup = () => {
  let clock = 0;
  return {
    show: new ShowController({...DEFAULTS,jellyMode:"trigger-count"}, () => clock, "session"),
    advance: (t) => (clock += t * 1000),
  };
};
const event = (n) => ({
  sessionId: "session",
  senderId: "tablet",
  sequence: n,
  eventId: `tablet:${n}`,
  phraseId: "p",
});
test("central event ownership, pending boundary and ten rounds have no duplicate counts", () => {
  const { show, advance } = setup();
  show.accept(event(1));
  show.begin(100, 1);
  assert.equal(show.count, 1);
  assert.equal(show.accept(event(1)).accepted, false);
  assert.equal(show.accept({ ...event(2), sessionId: "old" }).valid, false);
  show.report(80);
  assert.ok(show.snapshot().fade > 0);
  show.accept(event(2));
  assert.equal(show.count, 2);
  show.end();
  assert.equal(show.end(), false);
  show.accept(event(3));
  assert.equal(show.pending, 1);
  advance(30);
  assert.equal(show.snapshot().remaining, 0);
  show.begin(100, 2);
  assert.equal(show.count, 1);
  assert.equal(show.snapshot().fade, 0);
  for (let i = 0; i < 8; i++) {
    show.end();
    advance(30);
    show.begin(100, i + 3);
  }
  assert.equal(show.round, 10);
});
test("pause freezes video, hold and global scene until explicit resume", () => {
  const { show, advance } = setup();
  show.begin(100, 1);
  show.report(70);
  advance(1);
  show.pause();
  const a = show.snapshot();
  advance(20);
  assert.equal(show.snapshot().time, a.time);
  assert.equal(show.snapshot().sceneTime, a.sceneTime);
  show.resume();
  advance(2);
  assert.equal(show.snapshot().time, 73);
  show.end();
  advance(4);
  show.pause();
  advance(10);
  assert.equal(show.snapshot().remaining, 26);
  show.resume();
  advance(2);
  assert.equal(show.snapshot().remaining, 24);
});
test("settings apply on next round and late jelly births use shared scene time", () => {
  const { show } = setup();
  show.begin(100, 3);
  show.report(80);
  show.accept(event(1));
  show.accept(event(2));
  assert.equal(show.births[1], 40);
  show.nextSettings = { ...DEFAULTS, fadeSeconds: 5, holdSeconds: 2 };
  assert.equal(show.settings.fadeSeconds, 60);
  show.end();
  show.begin(100, 4);
  assert.equal(show.settings.fadeSeconds, 5);
});
