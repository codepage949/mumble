# VAD 병합 간격 이하 조건 반영

## 목표

- 웹페이지의 VAD 병합 간격 안내 문구를 실제 동작과 맞춘다.
- 설정된 간격과 정확히 같은 길이의 다음 문장도 병합되도록 VAD interval 병합 조건을 이하로 변경한다.

## 구현 계획

1. `app/index-tmpl.html`의 VAD 병합 간격 라벨을 `다음 간격 이하의 문장은 합치기(초)`로 변경한다.
2. `app/emscripten.cpp`의 `merge_vad_intervals()`에서 인접 VAD interval 간격이 설정값과 같은 경우도 병합하도록 비교 연산자를 `<=`로 변경한다.
3. `tests/whisper-wasm-vad-controls.test.js`의 웹 문구와 병합 조건 기대값, 테스트 설명을 이하 기준으로 갱신한다.
4. Deno 정적 테스트를 실행해 변경 사항을 검증한다.

## 테스트 계획

- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js`

## 구현 내용

- `app/index-tmpl.html`의 VAD 병합 간격 라벨을 `다음 간격 이하의 문장은 합치기(초)`로 변경했다.
- `app/emscripten.cpp`의 `merge_vad_intervals()`에서 인접 VAD interval 간격이 설정값과 같은 경우도 병합하도록 `<= merge_gap_cs` 조건을 적용했다.
- `tests/whisper-wasm-vad-controls.test.js`의 라벨 기대값, 테스트 이름, 병합 조건 기대값을 이하 기준으로 갱신했다.

## 테스트 결과

- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js` 통과.
