// Scene coordinates are shared by both outputs; Windows DIP coordinates never enter here.
export function viewport(
  channel,
  { width = 1920, height = 1080, gap = 0 } = {},
) {
  return {
    fullWidth: width,
    fullHeight: height * 2 + gap,
    x: 0,
    y: channel === "A" ? 0 : height + gap,
    width,
    height,
  };
}
export function seeded(seed, index) {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
export function jellyPose(index, time, seed, aspect = 1920 / 2160) {
  const r = (n) => seeded(seed, index * 11 + n);
  const layer = index % 3;
  let z,
    u,
    v,
    scale,
    edge = 1;
  if (index === 0) {
    z = 3.2 - Math.min(time, 100) * 0.2;
    const progress = Math.max(0, Math.min(1, (time - 18) / 65));
    // A ray through the centre of lower B; once in front of the lens, drift upwards.
    u = 0.5 + 0.08 * Math.sin(progress * Math.PI);
    v = 0.76 - 0.65 * (progress * progress * (3 - 2 * progress));
    scale = 2.5;
  } else {
    z = -([6, 11, 18][layer] + r(1) * 2);
    const progress = (r(2) * 0.18 + time * (0.009 + layer * 0.0006)) % 1;
    u = 0.25 + r(3) * 0.5 + Math.sin(time * 0.06 + r(4) * 6) * 0.06;
    v = 0.94 - progress * 0.9;
    const h = 2 * Math.tan((35 * Math.PI) / 360) * -z;
    scale = h * [0.14, 0.11, 0.085][layer] * (0.9 + r(5) * 0.2);
    edge = Math.min(1, progress / 0.025, (1 - progress) / 0.025);
  }
  const h = 2 * Math.tan((35 * Math.PI) / 360) * Math.max(0.025, -z);
  return {
    x: (u - 0.5) * h * aspect,
    y: (0.5 - v) * h,
    z,
    u,
    v,
    scale,
    edge,
    rotationZ: -0.12,
    rotationY: Math.sin(time * 0.12 + index) * 0.2,
    animationTime: time + r(6) * 20,
  };
}
export function localPoint(p, view) {
  return {
    x: (p.u * view.fullWidth - view.x) / view.width,
    y: (p.v * view.fullHeight - view.y) / view.height,
  };
}
export function mediaTime(channel, showTime, duration) {
  return channel === "B" && duration > 0 ? showTime % duration : showTime;
}
export function mediaCorrection(target, current, duration, loop) {
  let error = target - current;
  if (loop && duration > 0) {
    if (error > duration / 2) error -= duration;
    if (error < -duration / 2) error += duration;
  }
  return {
    error,
    seek: Math.abs(error) > 0.35,
    rate:
      Math.abs(error) < 0.035
        ? 1
        : Math.max(0.97, Math.min(1.03, 1 + error * 0.12)),
  };
}
