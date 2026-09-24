import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { DEFAULTS, validateSettings } from "../../video/config.js";
export const installationDefaults = {
  schemaVersion: 1,
  room: "sinopale",
  mapping: { A: null, B: null },
  layout: { width: 1920, height: 1080, gap: 0 },
  fit: { A: "cover", B: "contain" },
  media: {},
  show: { ...DEFAULTS },
};
export function validateInstallation(input) {
  if (!input || input.schemaVersion !== 1)
    throw new Error("지원하지 않는 설정 버전입니다.");
  const config = structuredClone(installationDefaults);
  config.show = validateSettings(input.show || {});
  if (
    config.show.modelUrl !== DEFAULTS.modelUrl ||
    config.show.triggerVideoUrl !== DEFAULTS.triggerVideoUrl
  )
    throw new Error(
      "Electron은 포함된 해파이 모델과 트리거영상 목록을 사용합니다.",
    );
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(input.room || ""))
    throw new Error("room 값은 영문/숫자/_/- 1~40자입니다.");
  config.room = input.room;
  for (const c of ["A", "B"]) {
    const id = input.mapping?.[c];
    if (id !== null && id !== undefined && !/^-?\d+$/.test(String(id)))
      throw new Error("디스플레이 ID 오류");
    config.mapping[c] = id == null ? null : String(id);
    if (!["contain", "cover"].includes(input.fit?.[c]))
      throw new Error("영상 맞춤 방식 오류");
    config.fit[c] = input.fit[c];
  }
  for (const [key, min, max] of [
    ["width", 320, 8192],
    ["height", 240, 8192],
    ["gap", 0, 4096],
  ]) {
    const n = input.layout?.[key];
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`논리 ${key}: ${min}~${max} 정수`);
    config.layout[key] = n;
  }
  config.media = {};
  for (const key of ["A", "B"])
    if (input.media?.[key]) {
      if (
        typeof input.media[key] !== "string" ||
        !path.isAbsolute(input.media[key])
      )
        throw new Error("영상 절대 경로 오류");
      config.media[key] = input.media[key];
    }
  return config;
}
export async function readSettings(file) {
  try {
    return validateInstallation(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT")
      console.warn("설정 기본값 복원:", error.message);
    return structuredClone(installationDefaults);
  }
}
export async function saveSettings(file, config) {
  const checked = validateInstallation(config);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + ".tmp", JSON.stringify(checked, null, 2));
  await rename(file + ".tmp", file);
  return checked;
}
