const api = window.installation,
  boot = await api.bootstrap(),
  form = document.querySelector("#settings"),
  error = document.querySelector("#error");
let state = boot.state,
  displayKey = "";
const fields = [
  "compositionJellies", "swarmDelay", "swarmRise", "swarmOpacity",
  "fadeSeconds",
  "holdSeconds",
  "minJellies",
  "maxJellies",
  "jelliesPerTrigger",
  "overlayOpacity",
  "overlaySeconds",
  "maxOverlays",
];
function fill() {
  for(const key of ["jellyMode","swarmDensity"])form.elements[key].value=state.config.show[key];
  for (const key of fields) form.elements[key].value = state.config.show[key];
  form.elements.fitA.value = state.config.fit.A;
  form.elements.fitB.value = state.config.fit.B;
}
async function command(name, data) {
  error.textContent = "";
  try {
    await api.command(name, data);
  } catch (e) {
    error.textContent = e.message;
  }
}
function render(next) {
  state = next;
  const {
    phase,
    round,
    count,
    pending,
    remaining,
    time,
    duration,
    health,
    message,
  } = state;
  document.querySelector("#mode").textContent = state.preview
    ? "미리보기 모드 · 한 모니터에서 두 출력 창을 확인합니다."
    : "설치 모드 · 서로 다른 두 디스플레이를 지정하세요.";
  document.querySelector("#status").textContent =
    `회차 ${round} · ${phase} · ${time.toFixed(1)} / ${duration.toFixed(1)}초\n문장트리거 ${count} · 다음 회차 ${pending} · 해파이 ${state.jellyCount} · 대기 ${remaining.toFixed(1)}초\n${["A", "B"].map((c) => `${c}: ${health[c]?.ready ? "준비됨" : "준비 중"} · ${(health[c]?.time || 0).toFixed(2)}초 · ${health[c]?.fps || 0} FPS · 누락 ${health[c]?.dropped || 0}`).join("\n")}\n${state.fallback ? "해파이 대체 실루엣 모드\n" : ""}${message}`;
  const key = JSON.stringify(state.displays);
  if (displayKey !== key) {
    displayKey = key;
    for (const c of ["A", "B"]) {
      const select = document.querySelector("#display-" + c);
      select.replaceChildren(new Option("디스플레이 선택", ""));
      for (const d of state.displays)
        select.add(
          new Option(
            `${d.label} · ${d.size.width}×${d.size.height} · ID ${d.id}`,
            d.id,
          ),
        );
      select.value = state.config.mapping[c] || "";
    }
  }
  document.querySelector("#media-A").textContent =
    "위 A: " +
    (state.config.media.A ||
      "assets/video/resonant-field-film/resonant_field_picture_01.mp4");
  document.querySelector("#media-B").textContent =
    "아래 B: " + (state.config.media.B || "assets/floorVideos/floor.mp4");
  document.querySelector("#tablet").textContent =
    `room: ${state.config.room} · 세션 ${state.sessionId}`;
  for (const button of document.querySelectorAll("button"))
    button.disabled = state.busy && button.dataset.command !== "quit";
}
render(state);
fill();
api.onState(render);
for (const el of document.querySelectorAll("[data-command]"))
  el.addEventListener("click", () => command(el.dataset.command));
document
  .querySelector("#map")
  .addEventListener("click", () =>
    command("map", {
      A: document.querySelector("#display-A").value,
      B: document.querySelector("#display-B").value,
    }),
  );
for (const c of ["A", "B"])
  document
    .querySelector("#choose-" + c)
    .addEventListener("click", () => command("select-media", c));
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const show = { ...state.config.show };
  for(const key of ["jellyMode","swarmDensity"])show[key]=form.elements[key].value;
  for (const key of fields) show[key] = Number(form.elements[key].value);
  await command("settings", {
    show,
    fit: { A: form.elements.fitA.value, B: form.elements.fitB.value },
  });
  if (!error.textContent) error.textContent = "저장했습니다.";
});

document
  .querySelector("#seek")
  .addEventListener("click", () =>
    command("seek", Number(document.querySelector("#seek-time").value)),
  );
