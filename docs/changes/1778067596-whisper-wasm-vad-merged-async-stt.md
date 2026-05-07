# Whisper WASM VAD 병합 후 비동기 STT

## 계획

- VAD가 켜진 경우 STT를 수행하지 않고 VAD speech interval만 계산한다.
- VAD interval 사이의 간격이 설정값 미만이면 하나의 결과 segment로 병합한다.
- VAD 병합 기준의 기본값은 0.5초이며 웹페이지에서 변경할 수 있다.
- 병합된 VAD segment를 원본 타임라인 기준 `t0`, `t1`으로 반환한다.
- VAD 전용 결과의 `text`는 빈 문자열로 반환한다.
- VAD 결과가 화면에 표시된 뒤 첫 번째 segment부터 순차적으로 STT를 수행해 텍스트를 비동기로 채운다.
- segment별 STT에는 이전 segment들의 전사 텍스트를 `initial_prompt` 힌트로 전달한다.
- segment별 STT에는 앞뒤 0.3초 패딩을 적용해 VAD 경계에서 음성이 잘리는 문제를 줄인다.
- 새 파일이 선택되면 진행 중인 STT에 취소 신호를 보내고 기존 worker가 종료될 때까지 기다린 뒤 새 파일 처리를 시작한다.
- VAD가 꺼진 경우 기존처럼 전체 오디오를 한 번 STT한다.
- 관련 WASM 바인딩 테스트를 새 동작 기준으로 갱신한다.

## 구현

- `app/emscripten.cpp`에서 VAD 모드의 interval별 STT 호출을 제거했다.
- `WHISPER_WASM_DEFAULT_VAD_MERGE_GAP_CS = 50`을 추가해 기본 0.5초 병합 기준을 명시했다.
- `merge_vad_intervals()`를 추가해 인접하거나 겹치는 VAD interval을 병합한다.
- `full_default()`가 웹페이지에서 전달한 VAD 병합 기준 ms 값을 받아 centisecond 기준으로 변환해 `merge_vad_intervals()`에 전달하도록 했다.
- 웹페이지에 `Combine pauses under (s)` 숫자 입력을 추가했고 기본값을 `0.5`로 설정했다.
- `append_vad_segments()`를 추가해 병합된 VAD interval을 빈 텍스트 segment로 반환한다.
- VAD가 꺼진 경우에는 기존처럼 전체 PCM을 한 번만 STT한다.
- 웹 로그 문구를 VAD segment STT가 아니라 VAD 전용 segment 반환으로 보이도록 갱신했다.
- 기존 interval별 PCM chunk 복사와 `whisper_full()` 호출 흐름은 제거했다.
- `transcribe_segment()` WASM 바인딩을 추가해 단일 VAD segment의 STT를 비동기로 실행한다.
- `transcribeVadSegmentsSequentially()`를 추가해 VAD 결과 표시 후 segment를 앞에서부터 순차적으로 전사한다.
- 각 segment STT 결과가 완료될 때마다 해당 result row의 텍스트만 갱신한다.
- STT 수행 중인 segment는 완료 전까지 `...`로 표시한다.
- 이전 segment들의 전사 텍스트를 최대 500자까지 누적해 다음 segment의 `initial_prompt`로 전달한다.
- segment별 STT 입력 PCM은 원래 VAD 구간보다 앞뒤 0.3초 넓게 잘라 품질 힌트로 사용하되, 표시 시간은 VAD segment의 원래 `t0`, `t1`을 유지한다.
- `cancel()` WASM 바인딩과 전역 cancel flag를 추가했다.
- `whisper_full()`의 `abort_callback`과 `encoder_begin_callback`에 cancel flag를 연결해 실행 중인 STT가 가능한 지점에서 중단되도록 했다.
- 웹 UI는 새 파일 선택 시 `cancel()`을 호출하고 `get_result()`가 ready가 될 때까지 대기한 뒤 다음 작업을 시작한다.
- 새 파일 선택마다 `transcriptionRunId`를 증가시켜 오래된 비동기 작업이 결과나 에러를 현재 화면에 반영하지 못하게 했다.

## 테스트

- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js tests/vad-filtered-audio-silence-gap.test.js` 통과.
- `cmake --build build-em --target libmain -j2` 통과.
