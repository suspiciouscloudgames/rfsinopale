export function resolveDisplays(displays, mapping) {
  const A = displays.find((d) => String(d.id) === String(mapping.A));
  const B = displays.find((d) => String(d.id) === String(mapping.B));
  if (!A || !B || A.id === B.id)
    throw new Error("서로 다른 두 디스플레이를 위 A / 아래 B로 지정하세요.");
  return { A, B };
}
export function previewBounds(display) {
  const r = display.workArea;
  const height = Math.min(320, Math.floor((r.height - 90) / 2)),
    width = Math.round((height * 16) / 9);
  return {
    A: { x: r.x + 20, y: r.y + 30, width, height },
    B: { x: r.x + 20, y: r.y + height + 60, width, height },
  };
}

// A saved mapping wins, even when Windows numbers/order change. For a new
// installation choose only when there are exactly two outputs; a third display
// may be an operator monitor and must not be guessed.
export function startupMapping(displays, saved) {
  try {
    resolveDisplays(displays, saved);
    return { A: String(saved.A), B: String(saved.B) };
  } catch {}
  if (displays.length !== 2)
    throw new Error(
      "자동 시작에는 디스플레이 두 대 또는 유효한 저장 배치가 필요합니다. 위 A / 아래 B를 지정하세요.",
    );
  const ordered = [...displays].sort(
    (a, b) =>
      a.bounds.y - b.bounds.y ||
      a.bounds.x - b.bounds.x ||
      String(a.id).localeCompare(String(b.id)),
  );
  return { A: String(ordered[0].id), B: String(ordered[1].id) };
}
