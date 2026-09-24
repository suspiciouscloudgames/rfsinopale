# RF projection video — editing source

프로젝션 영상 재편집에 사용하는 원본 클립 24개입니다. `RF_video/clips`에서 복사했으며, 원본 파일은 변경하지 않았습니다.

- 저장소: suspiciouscloudgames/rfsinopale
- 편집 브랜치: `video-editing`
- 원본 영상: `clips/`
- 크기와 SHA-256: `manifest.json` (최초 가져온 원본 기준)
- 웹 상영 배포 브랜치: `gh-pages`

이 브랜치에 클립이나 편집 작업을 커밋해도 현재 상영 페이지는 바뀌지 않습니다. 완성된 영상의 웹 교체는 별도 작업입니다. `video-editing`을 `gh-pages`에 그대로 병합하지 마세요.

## 내려받기

Git LFS 설치 후 다음 명령을 사용합니다. GitHub의 Download ZIP 대신 Git으로 내려받아야 실제 영상 파일을 확실히 받을 수 있습니다.

```sh
git lfs install
git clone --branch video-editing --single-branch https://github.com/suspiciouscloudgames/rfsinopale.git rfsinopale-video
cd rfsinopale-video
git lfs pull
```

## 수정 공유

`clips/`의 원본은 가능한 유지하고 편집 프로젝트 파일을 함께 커밋하세요. 새 원본 클립도 `clips/`에 넣으면 LFS로 관리됩니다. 임시 렌더는 `renders/`에 보관하면 커밋에서 제외됩니다.

```sh
git pull --ff-only
git add clips/ # 필요하면 편집 프로젝트 파일 경로도 추가
git commit -m "Update video editing sources"
git push origin video-editing
```

## 최신 시스템 코드와 실행 방법

[HANDOFF.md](HANDOFF.md)에 최신 아이패드·스크린 구성, 두 저장소 내려받기, 로컬 실행, 자막 타이밍, 미구현 항목을 정리했습니다. `public/video/`는 위쪽 스크린 코드, `floor-clips/`는 앞으로 추가할 바닥 영상 폴더입니다.
