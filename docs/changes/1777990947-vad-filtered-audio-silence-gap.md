# VAD 필터 오디오 실제 무음 간격 반영

## 요청

- VAD로 잘라낸 speech segment 사이에 삽입하는 무음을 고정값이 아니라 실제 segment 사이 간격에 비례하도록 바꾼다.
- VAD speech 종료 감지용 `min_silence_duration_ms` 기본값을 300ms로 조정한다.
- 웹페이지에서 `min_silence_duration_ms` 값을 설정할 수 있게 한다.
- filtered audio에 삽입하는 무음은 실제 간격을 반영하되 최대 1초로 제한한다.
- Whisper가 VAD로 압축된 입력에서도 발화 사이 간격을 더 잘 문장 분리 힌트로 사용할 수 있게 한다.

## 구현 계획

1. `external/whisper.cpp/src/whisper.cpp`의 VAD filtered audio 재조립 구간에서 speech segment 사이 실제 원본 gap을 계산한다.
2. 각 gap별 삽입 무음은 실제 gap과 1초 상한 중 작은 값을 사용한다.
3. 각 gap별 삽입 무음 샘플 수를 저장한 뒤 전체 filtered audio 크기 계산과 실제 `memset()` 삽입에 같은 값을 사용한다.
4. VAD 기본 `min_silence_duration_ms`를 300ms로 변경하고 관련 테스트 기대값을 맞춘다.
5. WASM `full_default` 바인딩이 웹페이지에서 전달한 VAD 최소 무음 시간을 `whisper_full_params`에 반영하도록 한다.
6. 웹페이지에 VAD 최소 무음 시간 숫자 입력을 추가하고 기본값을 300ms로 설정한다.
7. 정적 테스트로 VAD 삽입 무음이 실제 segment gap 기반으로 계산되고 기존 고정 0.1초/0.5초 literal을 쓰지 않는지 검증한다.
8. 가능한 빌드 또는 테스트를 실행해 변경을 확인한다.

## 테스트 계획

- Deno 기반 정적 테스트로 `external/whisper.cpp/src/whisper.cpp`의 VAD filtered audio silence gap 계산을 검증한다.
- Deno 기반 정적 테스트로 VAD 기본 `min_silence_duration_ms`가 300ms인지 검증한다.
- Deno 기반 정적 테스트로 웹페이지 VAD 최소 무음 시간 입력과 WASM 바인딩 전달 경로를 검증한다.
- 기존 WASM 오디오 유틸 테스트가 계속 통과하는지 확인한다.

## 구현 내용

- `external/whisper.cpp/src/whisper.cpp`의 VAD 기본 `min_silence_duration_ms`를 100ms에서 300ms로 변경했다.
- `tests/test-vad.cpp`와 `tests/test-vad-full.cpp`의 VAD silence duration 기대값을 300ms로 맞췄다.
- `app/emscripten.cpp`의 `full_default` 바인딩이 `vad_min_silence_ms` 인자를 받아 `params.vad_params.min_silence_duration_ms`에 반영하도록 했다.
- `app/index-tmpl.html`에 `VAD silence ms` 숫자 입력을 추가하고 기본값을 300ms로 설정했다.
- 웹페이지에서 VAD 최소 무음 시간 입력값을 50~2000ms 범위로 clamp한 뒤 `Module.full_default()`에 전달하도록 했다.
- `external/whisper.cpp/src/whisper.cpp`의 VAD filtered audio 재조립 구간에서 speech segment 사이 삽입 무음을 고정값 대신 `next.start - current.end` 실제 원본 gap 기반으로 계산하도록 변경했다.
- filtered audio에 삽입하는 무음은 최대 1초, 즉 100 centiseconds로 제한했다.
- 각 gap별 `silence_samples`를 `silence_samples_by_gap`에 저장하고, `total_samples_needed` 계산과 실제 무음 삽입에 같은 값을 사용하도록 했다.
- `tests/vad-filtered-audio-silence-gap.test.js`를 추가해 VAD 기본 무음 감지 시간과 filtered audio 삽입 무음 계산을 정적 검증한다.
- `tests/whisper-wasm-vad-controls.test.js`를 추가해 웹페이지 입력과 WASM 바인딩 전달 경로를 정적 검증한다.

## 검증 결과

- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp tests/vad-filtered-audio-silence-gap.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/emscripten.cpp tests/whisper-wasm-vad-controls.test.js` 통과.
- `deno test tests/whisper-wasm-audio-utils.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.

## 미검증 항목

- 실제 오디오에서 문장 분리 결과가 의도대로 개선되는지는 브라우저 전사 결과로 확인해야 한다.
