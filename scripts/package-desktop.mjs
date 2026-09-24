import { packager } from "@electron/packager";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  stat,
  readdir,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  stage = await mkdtemp(path.join(os.tmpdir(), "drifting-sea-package-"));
const files = [
  "desktop",
  "shared",
  "video",
  "animation/jellyfish_slow_swim.glb",
  "assets/video/resonant-field-film",
  "assets/floorVideos/poiesis-floor-v1.mp4",
  "assets/audio/stuck-final.mp3",
  "assets/audio/CREDITS.md",
  "assets/tiggerVideos/web",
];
async function hashes(base, directory = base) {
  const result = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) Object.assign(result, await hashes(base, file));
    else {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      result[path.relative(base, file).split(path.sep).join("/")] =
        hash.digest("hex");
    }
  }
  return result;
}
try {
  for (const file of files) {
    const source = path.join(root, file);
    await stat(source);
    await mkdir(path.dirname(path.join(stage, file)), { recursive: true });
    await cp(source, path.join(stage, file), { recursive: true });
  }
  const pkg = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  await writeFile(
    path.join(stage, "package.json"),
    JSON.stringify({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      type: "module",
      main: pkg.main,
    }),
  );
  const paths = await packager({
    dir: stage,
    out: path.join(root, "dist"),
    name: "Drifting Sea",
    platform: "win32",
    arch: "x64",
    electronVersion: pkg.devDependencies.electron,
    asar: false,
    overwrite: true,
    prune: false,
  });
  for (const dir of paths) {
    const checksums = await hashes(path.join(dir, "resources/app"));
    await writeFile(
      path.join(dir, "runtime-sha256.json"),
      JSON.stringify(checksums, null, 2),
    );
    await writeFile(
      path.join(dir, "START-HERE.txt"),
      'Drifting Sea 2채널 상영\r\nDrifting Sea.exe 더블클릭 → 저장 배치 복원 또는 두 화면 자동 지정 → 2채널 전체화면 자동 상영\r\n운영 화면: 출력에서 O 키. 최초에 Windows가 위아래 배치를 모르면 왼쪽=A, 오른쪽=B로 선택됩니다. O 키로 수정 가능합니다.\r\n미리보기: "Drifting Sea.exe" --preview\r\n미디어는 resources/app/assets 및 resources/app/animation에 포함됩니다.\r\nWindows 현장 검증 및 코드 서명은 별도입니다.\r\n',
    );
    console.log(dir);
  }
} finally {
  await rm(stage, { recursive: true, force: true });
}
