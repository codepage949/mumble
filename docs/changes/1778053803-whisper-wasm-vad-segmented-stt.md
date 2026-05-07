# Whisper WASM VAD 기준 세그먼트별 STT

## 계획

- VAD가 켜진 경우 전체 오디오를 먼저 STT한 뒤 결과 시간을 보정하던 흐름을 바꾼다.
- VAD로 원본 오디오의 speech interval만 먼저 계산한다.
- 각 VAD interval에 해당하는 원본 PCM 구간을 독립적으로 `whisper_full()`에 전달한다.
- 각 호출 결과의 `t0`, `t1`은 VAD interval 시작 시각을 더해 원본 타임라인 기준으로 반환한다.
- VAD가 꺼진 경우 기존처럼 전체 오디오를 한 번만 STT한다.
- 관련 WASM 바인딩 테스트를 새 동작 기준으로 갱신한다.

## 구현

- `app/emscripten.cpp`에서 VAD 모드의 처리 순서를 변경했다.
- `detect_vad_intervals()`로 원본 PCM의 VAD interval을 먼저 계산한다.
- `transcribe_vad_interval()`을 추가해 각 interval의 원본 PCM 범위를 별도 `chunk`로 만들어 `whisper_full()`을 호출한다.
- VAD interval별 호출에는 `single_segment = true`를 적용해 반환 세그먼트가 VAD 기준 경계를 따르도록 했다.
- VAD interval별 STT 결과는 `interval.start`, `interval.end`를 그대로 반환해 원본 타임라인 기준 세그먼트로 표시한다.
- VAD가 꺼진 경우에는 기존처럼 전체 PCM을 한 번만 STT한다.
- 기존 전체 STT 결과를 VAD와 겹쳐 보정하고 병합하던 흐름은 제거했다.
- 웹 로그 문구를 VAD 보정이 아니라 VAD 세그먼트별 STT로 보이도록 갱신했다.

## 테스트

- `tests/whisper-wasm-vad-controls.test.js`를 VAD interval별 STT 흐름과 웹 로그 문구를 검증하도록 갱신했다.
- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js tests/vad-filtered-audio-silence-gap.test.js` 통과.
- `cmake --build build-em --target libmain -j2` 통과.
