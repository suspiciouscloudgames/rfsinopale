export async function createSubtitles(root) {
  const names = [
    "resonant_field_subtitles.json",
    "resonant_field_subtitles_tr.json",
    "resonant_field_subtitles_en.json",
  ];
  const [timing, tr, en] = await Promise.all(
    names.map(async (name) => {
      const r = await fetch("/subtitles/" + name);
      if (!r.ok) throw new Error("자막 로딩 실패");
      return r.json();
    }),
  );
  const text = (list) => new Map(list.subtitles.map((c) => [c.id, c.text])),
    turkish = text(tr),
    english = text(en);
  const cues = timing.subtitles.map((c) => ({
    ...c,
    tr: turkish.get(c.id) || "",
    en: english.get(c.id) || "",
  }));
  const lines = [
      root.querySelector("#subtitle-tr"),
      root.querySelector("#subtitle-en"),
    ],
    measure = document.createElement("canvas").getContext("2d");
  function parts(text, width, font) {
    measure.font = font;
    const out = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (line && measure.measureText(line + " " + word).width > width) {
        out.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) out.push(line);
    return out;
  }
  let last = "";
  return (time) => {
    const cue = cues.find((c) => time >= c.start && time < c.end);
    const key = cue
      ? `${cue.id}:${Math.floor(time * 10)}:${root.clientWidth}`
      : "";
    if (key === last) return;
    last = key;
    lines.forEach((el, i) => {
      if (!cue) {
        el.textContent = "";
        return;
      }
      const chunks = parts(
        i ? cue.en : cue.tr,
        root.clientWidth - 4,
        getComputedStyle(el).font,
      );
      el.textContent =
        chunks[
          Math.min(
            chunks.length - 1,
            Math.floor(
              ((time - cue.start) / (cue.end - cue.start)) * chunks.length,
            ),
          )
        ] || "";
    });
    root.classList.toggle("dark", cue?.id === 22 || cue?.id === 23);
  };
}
