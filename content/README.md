# Runtime text content — reserved

향후 빌드 없이 JSON 파일 교체로 UI 문구, 관찰 콘텐츠, 자막을 갱신하기 위한 예약 영역이다.

현재 앱은 이 폴더를 아직 읽지 않는다. 런타임 JSON 로더, 스키마 검증, fallback, PWA 캐시 버전 처리가 구현되기 전에는 `src/content/`와 `src/locales/`가 실제 텍스트 원본이다.

상세 규칙은 `docs/content_asset_hierarchy_and_workflow.md`를 참조한다.
