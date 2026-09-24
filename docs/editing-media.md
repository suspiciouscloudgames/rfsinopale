# 함께 편집할 영상 소재

이제 새 편집의 입력 폴더는 다음 두 곳이다.

- 위 스크린: `assets/video/source-clips/`
- 바닥 스크린: `assets/floorVideos/source-clips/`

위 폴더에는 작가의 기존 `clips`와 호연의 상단 편집 영상, 트리거 원본 및 웹 변환본을 함께 모았다. 바닥 폴더에는 작가의 `floor-clips`와 호연의 `floor.mp4`를 모았다. `youngju__`, `hoyeon-main__`, `hoyeon-trigger-source__`, `hoyeon-trigger-web__` 접두어로 출처를 구별한다. 같은 내용의 파일은 SHA-256으로 중복을 확인한다. 웹 변환본과 원본은 내용이 다르므로 함께 보존하며, 재편집에는 원본을 우선 사용한다.

현재 상영 중인 파일은 기존 위치에 그대로 유지한다. 이 소재 폴더에 파일을 추가하는 것은 상영 프로그램을 바꾸지 않는다. 기존 `clips`, `floor-clips`도 이번에는 삭제하지 않았다.

파일 목록, 출처 및 해시: `content/manifests/editing-media.json`.
추가된 원본을 다시 모으는 명령: `python3 scripts/collect-editing-media.py`.

소재 폴더는 용량을 중복 사용하지 않도록 원본을 가리키는 상대 심볼릭 링크로 구성한다. 원본이 있는 기존 `clips`, `floor-clips`와 호연의 미디어 폴더는 삭제하면 안 된다. 소재 폴더에 직접 넣은 새 영상은 그대로 보존한다. 이 링크들은 로컬 작업용이며 Git에 추가하지 않는다. 다른 컴퓨터에서는 원본을 확보한 뒤 수집 스크립트를 실행해야 한다. GitHub에 원본들을 공유할 때는 별도 LFS 업로드가 필요하다. 이 소재로 만든 1차 편집본과 타임라인은 `docs/picture-edit-v1.md`에 정리했다. 편집용 폴더에서 제거된 사본은 동기화 스크립트가 다시 만들지 않는다.
