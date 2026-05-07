# whisper.wasm VAD 비활성화와 기본 전사 복귀

## 요청

- VAD 기반 전사와 재생 시간축 보정 시도가 처리 시간과 품질 면에서 적합하지 않으므로 제거한다.
- wasm 예제는 VAD 없이 원래 기본 전사 옵션으로 동작하게 한다.

## 구현 계획

1. wasm 예제에서 브라우저가 VAD 모델을 로드하지 않게 한다.
2. 전사 호출 시 `params.vad`를 항상 `false`로 설정하고 VAD 모델 경로를 비운다.
3. VAD filtered audio 재생, raw timestamp, segment 종료 보정, 보정 로그 코드를 제거한다.
4. 테스트와 문서를 VAD 비활성 기본 전사 경로에 맞게 갱신한다.
5. 정적 테스트와 WASM 빌드로 검증한다.

## 구현 내용

- `app/index-tmpl.html`에서 VAD silence 입력, VAD 모델 URL, VAD 모델 preload, VAD 전사 호출을 제거했다.
- 브라우저 전사 호출은 `Module.full_default(..., false, false, 0)`으로 고정했다.
- `app/emscripten.cpp`에서 `params.vad = false`, `params.vad_model_path = nullptr`로 고정하고 VAD 옵션 override를 제거했다.
- VAD filtered playback PCM, raw segment timestamp getter, 삽입 무음 기반 segment 종료 보정, 보정 로그 반환 코드를 제거했다.
- `app/CMakeLists.txt`와 `scripts/build-whisper-wasm-static.sh`에서 wasm 페이지용 VAD 모델 URL 설정을 제거했다.
- `app/README.md`에서 정적 wasm 빌드가 Whisper 모델 URL만 사용한다고 설명을 갱신했다.

## 검증 결과

- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp,app/emscripten.cpp tests/vad-samples-overlap-default.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/emscripten.cpp tests/whisper-wasm-vad-controls.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/CMakeLists.txt,scripts/build-whisper-wasm-static.sh tests/whisper-wasm-remote-model-assets.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html tests/whisper-wasm-segment-playback-precision.test.js` 통과.
- `deno test tests/whisper-wasm-audio-utils.test.js` 통과.
- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp tests/vad-filtered-audio-silence-gap.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.
- 생성된 `build-em/bin/whisper.wasm/index-tmpl.html`에서 VAD 모델 로딩 문자열이 없고 `Module.full_default(..., false, false, 0)` 호출만 남은 것을 확인했다.
