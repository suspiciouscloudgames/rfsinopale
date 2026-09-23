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
