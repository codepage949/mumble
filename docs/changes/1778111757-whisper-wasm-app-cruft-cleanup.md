# whisper.wasm 앱 군더더기 정리

## 확인 내용

- 과거 `whisper.cpp` 예제에서 가져온 `helpers.js`는 현재 `printTextarea`만 사용하지만, 파일 대부분은 더 이상 사용하지 않는 IndexedDB 모델 캐시 로더였다.
- 현재 앱은 VAD 구간을 먼저 반환한 뒤 구간별 STT를 수행하므로, 이전 VAD timestamp 보정 시도에서 남은 `vadCorrectionLogs`, `rawT0`, `correctedT0` 같은 이름과 필드는 실제 의미와 맞지 않았다.
- VAD 최소 무음 시간 입력은 제거된 상태라 `full_default()`의 `vad_min_silence_ms` 인자는 항상 `0`으로 전달되는 죽은 인자였다.

## 구현

- `printTextarea()`를 `index-tmpl.html`에 필요한 최소 구현으로 인라인하고 `app/helpers.js` 복사와 로드를 제거했다.
- WASM 결과의 VAD 로그를 `vadCorrectionLogs`에서 `vadLogs`로 바꾸고, 로그 필드를 `index`, `start`, `end`만 남겼다.
- `full_default()`의 `vad_min_silence_ms` 인자를 제거하고 VAD 기본 파라미터를 그대로 사용하게 했다.
- 빌드 디렉터리 재사용 시 삭제된 정적 파일이 남지 않도록 `build-em/bin/whisper.wasm` 산출물 디렉터리를 CMake configure 전에 비우게 했다.
- 상대 `BUILD_DIR`도 정확히 정리되도록 절대 경로로 정규화하고, Ninja가 재링크하지 않는 경우에도 기존 `libmain.js`를 산출물 `main.js`로 복사하게 했다.
- README와 정적 테스트를 현재 구조와 이름에 맞게 갱신했다.

## 테스트

- `deno task test`
