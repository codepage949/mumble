# Whisper WASM 재생 시작 보정

## 계획

- VAD segment의 실제 `t0`, `t1` 데이터와 STT 입력 구간은 변경하지 않는다.
- 사용자가 segment를 클릭해 재생할 때만 시작 위치를 0.1초 앞당긴다.
- 재생 시작 위치가 0초보다 작아지지 않도록 보정한다.
- 관련 WASM 페이지 테스트를 갱신한다.

## 구현

- `app/index-tmpl.html`에 `kSegmentPlaybackLeadSeconds = 0.1`을 추가했다.
- `playSegment()`에서 `audioEl.currentTime`을 설정할 때 `segment.t0`보다 0.1초 앞선 위치를 사용하도록 했다.
- `Math.max(0, ...)`로 0초보다 앞선 재생 위치가 설정되지 않게 했다.
- segment 표시 시간, VAD 결과, STT 입력 범위는 변경하지 않았다.

## 테스트

- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js` 통과.
- `cmake --build build-em --target libmain -j2` 통과.
