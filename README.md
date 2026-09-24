# Drifting Sea — Sinopale

정적 웹 전시 앱 및 영상 상영 화면. 메인 3D 체험은 기존 배포 번들이며, `video/`에는 편집 가능한 상영 코드가 있다.

## 실행

```sh
python3 scripts/dev-server.py
```

상영: http://127.0.0.1:5189/rfsinopale/video/
설정: http://127.0.0.1:5189/rfsinopale/video/settings.html
태블릿: http://127.0.0.1:5190/?room=sinopale

태블릿은 형제 디렉터리 `../gamepoem` 프로젝트를 사용한다. 두 프로젝트의 변경을 함께 배포한다.

- [운영 안내](docs/screening-operations.md)
- [단계별 구현·검증 결과](docs/implementation-stages.md)
- [상영 설계](docs/screening-redesign.md)

검증: `npm test` (Node.js 22 기준, 별도 설치 의존성 없음).
상영 파일 변경 후 캐시 갱신: `npm run cache`.

## Windows 2채널 Electron 앱

위에는 기존 영상, 아래에는 `assets/floorVideos/floor.mp4`를 재생한다. 해파이는 두 출력에 걸친 공통 장면을 사용한다.

```sh
npm ci
npm run desktop:preview  # 한 모니터에서 상하 출력 미리보기
npm run desktop          # 화면 배치 복원/자동 지정 후 2채널 자동 상영
npm run desktop:verify   # Electron 실동작 검증
npm run desktop:package:win
```

Windows 결과: `dist/Drifting Sea-win32-x64/Drifting Sea.exe`. 폴더 전체를 복사해 실행하면 두 디스플레이 전체화면 상영을 자동 시작한다. 운영 화면은 O 키로 연다.

- [2채널 운영 안내](docs/dual-channel-operations.md)
- [2채널 설계](docs/dual-channel-installation-design.md)
- [단계별 구현·검증 기록](docs/dual-channel-implementation.md)

Electron에는 Game Poem snapshot을 포함한다. `npm run tablet:sync`로 형제 프로젝트의 변경을 반영한다. 자동 테스트는 포함된 snapshot을 사용하며 형제 저장소 없이 실행할 수 있다. 물리 태블릿의 기존 PeerJS 연결에는 네트워크가 필요하다.
