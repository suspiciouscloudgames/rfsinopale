import test from "node:test";
import assert from "node:assert/strict";
import {
  viewport,
  jellyPose,
  localPoint,
  mediaCorrection,
  mediaTime,
} from "../shared/show/scene.js";
import {
  PerspectiveCamera,
  Vector3,
} from "../video/vendor/three/three.module.js";
test("top A and bottom B share an exactly continuous perspective at the seam", () => {
  const a = viewport("A"),
    b = viewport("B");
  assert.equal(a.y, 0);
  assert.equal(b.y, 1080);
  const projection = (v) => {
    const c = new PerspectiveCamera(35, 1, 0.025, 50);
    c.setViewOffset(v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height);
    return new Vector3(0, 0, -10).project(c);
  };
  assert.ok(Math.abs(projection(a).y + 1) < 1e-10);
  assert.ok(Math.abs(projection(b).y - 1) < 1e-10);
  assert.equal(localPoint({ u: 0.5, v: 0.5 }, a).y, 1);
  assert.equal(localPoint({ u: 0.5, v: 0.5 }, b).y, 0);
});
test("shared pose crosses from lower B into upper A with deterministic animation regardless of frame history", () => {
  for (let i = 0; i < 16; i++) {
    const start = jellyPose(i, 20, 42),
      end = jellyPose(i, 75, 42);
    assert.ok(start.v > 0.5);
    assert.ok(end.v < 0.5);
    assert.deepEqual(end, jellyPose(i, 75, 42));
  }
  const p = jellyPose(0, 0, 2);
  assert.ok(p.z > 0);
  assert.ok(p.v > 0.5);
  assert.equal(jellyPose(0, 16, 2).z, 0);
  assert.notDeepEqual(jellyPose(2, 35, 42), jellyPose(2, 35, 43));
});
test("loop synchronization takes the shortest error across B boundary", () => {
  assert.equal(mediaTime("B", 23, 10), 3);
  assert.equal(mediaTime("A", 23, 10), 23);
  assert.ok(
    Math.abs(mediaCorrection(0.02, 9.99, 10, true).error - 0.03) < 1e-8,
  );
  assert.equal(mediaCorrection(30, 20, 100, false).seek, true);
  assert.equal(mediaCorrection(1, 1, 100, false).rate, 1);
});
