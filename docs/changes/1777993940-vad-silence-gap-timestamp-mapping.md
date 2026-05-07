# VAD 무음 상한 timestamp mapping 보정

## 요청

- VAD filtered audio에 삽입하는 무음 상한 1초가 timestamp mapping에 영향을 주는지 확인한다.
- 상한으로 압축된 무음 구간이 원본 전체 gap으로 선형 보간되지 않도록 보정한다.
- 마지막 변경 문서를 갱신하지 않고 새 변경 문서로 기록한다.

## 구현 계획

1. VAD filtered audio의 무음 삽입 구간에서 삽입된 무음 길이와 원본 gap 길이를 분리해서 계산한다.
2. 삽입된 무음 내부는 실제 삽입 길이만큼만 원본 시간에 매핑한다.
3. 원본 gap이 1초 상한보다 길면, 삽입 무음 마지막 직전 지점까지는 원본 gap 앞부분에 매핑하고 다음 speech 시작점에서 원본 다음 segment 시작으로 이동하도록 한다.
4. 정적 테스트로 mapping 보정 지점이 유지되는지 검증한다.
5. 관련 테스트와 WASM 빌드를 실행한다.

## 테스트 계획

- Deno 기반 정적 테스트로 VAD filtered audio silence gap mapping 보정이 포함되어 있는지 검증한다.
- VAD overlap 제거 정적 테스트와 WASM VAD control 정적 테스트가 계속 통과하는지 확인한다.
- WASM 빌드가 계속 통과하는지 확인한다.

## 구현 내용

- `external/whisper.cpp/src/whisper.cpp`에서 VAD silence gap mapping 시 `mapped_silence_end`를 추가했다.
- 삽입된 silence 구간 내부는 `orig_silence_start + inserted_silence_cs`까지만 선형 매핑하도록 했다.
- 원본 gap이 상한보다 긴 경우 `silence_end_vad - 1`에 보정 mapping point를 추가하고, `silence_end_vad`에는 원본 다음 segment 시작 시간인 `orig_silence_end`를 매핑하도록 했다.
- mapping table reserve 크기를 gap별 추가 mapping point를 고려해 `vad_segments->data.size() * 5`로 늘렸다.
- `tests/vad-filtered-audio-silence-gap.test.js`에 mapping 보정 검증을 추가했다.

## 검증 결과

- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp tests/vad-filtered-audio-silence-gap.test.js` 통과.
- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp,app/emscripten.cpp tests/vad-samples-overlap-default.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/emscripten.cpp tests/whisper-wasm-vad-controls.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.

## 미검증 항목

- 실제 오디오에서 timestamp 경계와 텍스트 segment 배치가 의도대로 개선되는지는 브라우저 전사 결과로 확인해야 한다.
