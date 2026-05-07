# whisper.wasm 세그먼트 재생 시간 정밀도 표시

## 요청

- 웹페이지에서 전사 문장을 눌러 재생할 때 사용하는 시간이 소수점 정밀도를 포함하도록 한다.
- 화면에 표시되는 세그먼트 시간도 재생에 쓰이는 정밀도와 맞게 확인할 수 있게 한다.
- 마지막 변경 문서를 갱신하지 않고 새 변경 문서로 기록한다.

## 구현 계획

1. centisecond 단위 segment timestamp를 초 단위 소수로 변환하는 헬퍼를 추가한다.
2. `playSegment()`가 해당 헬퍼를 사용해 `audio.currentTime`과 stop time에 소수 초를 전달하도록 명시한다.
3. `formatTime()`이 정수 초 반올림 대신 소수점 2자리까지 표시하도록 변경한다.
4. 정적 테스트로 재생 시간 변환과 표시 포맷이 소수점 정밀도를 유지하는지 검증한다.

## 테스트 계획

- Deno 기반 정적 테스트로 웹페이지의 segment 재생 시간이 centisecond 기반 소수 초 변환을 사용하는지 검증한다.
- 기존 WASM VAD control 정적 테스트가 계속 통과하는지 확인한다.

## 구현 내용

- `app/index-tmpl.html`에 `segmentTimeSeconds()` 헬퍼를 추가해 centisecond 단위 timestamp를 초 단위 소수로 변환하도록 했다.
- `playSegment()`가 `stopAt`과 `audioEl.currentTime` 설정에 `segmentTimeSeconds()`를 사용하도록 했다.
- `formatTime()`이 정수 초 반올림 대신 `toFixed(2)`를 사용해 `MM:SS.ss` 형식으로 표시하도록 했다.
- `tests/whisper-wasm-segment-playback-precision.test.js`를 추가해 재생 시간 전달과 표시 포맷의 정밀도를 정적 검증한다.

## 검증 결과

- `deno test --allow-read=app/index-tmpl.html tests/whisper-wasm-segment-playback-precision.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/emscripten.cpp tests/whisper-wasm-vad-controls.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.

## 미검증 항목

- 브라우저에서 실제 오디오 요소의 seek 정밀도는 브라우저와 미디어 포맷 구현에 따라 달라질 수 있다.
