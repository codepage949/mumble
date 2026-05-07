# VAD 기본 samples overlap 제거

## 요청

- VAD speech segment를 filtered audio로 재조립할 때 기본 overlap을 없앤다.
- whisper.wasm 전사 경로에서는 VAD speech padding도 0ms로 명시해 경계 중복을 줄인다.
- segment 경계 중복 오디오가 문장 결합에 영향을 주는지 확인할 수 있게 한다.
- 마지막 변경 문서를 갱신하지 않고 새 변경 문서로 기록한다.

## 구현 계획

1. `whisper_vad_default_params()`의 `samples_overlap` 기본값을 `0.1`에서 `0.0f`로 변경한다.
2. VAD 기본값 검증 테스트의 기대값을 `0.0f`로 갱신한다.
3. whisper.wasm 전사 경로에서 VAD `samples_overlap`과 `speech_pad_ms`를 명시적으로 0으로 설정한다.
4. 정적 테스트를 추가해 core VAD 기본 overlap과 whisper.wasm VAD 경계 설정을 검증한다.
5. 관련 테스트와 WASM 빌드를 실행한다.

## 테스트 계획

- Deno 기반 정적 테스트로 `external/whisper.cpp/src/whisper.cpp`의 VAD 기본 `samples_overlap`이 0인지 검증한다.
- Deno 기반 정적 테스트로 `app/emscripten.cpp`가 VAD `samples_overlap`과 `speech_pad_ms`를 0으로 설정하는지 검증한다.
- 기존 VAD 기본값 테스트 기대값을 0으로 맞춘다.
- WASM 빌드가 계속 통과하는지 확인한다.

## 구현 내용

- `external/whisper.cpp/src/whisper.cpp`의 `whisper_vad_default_params()`에서 `samples_overlap` 기본값을 `0.1`에서 `0.0f`로 변경했다.
- `tests/test-vad.cpp`의 VAD 기본값 검증 기대값을 `0.0f`로 갱신했다.
- `app/emscripten.cpp`의 전사 경로에서 `params.vad_params.samples_overlap = 0.0f`와 `params.vad_params.speech_pad_ms = 0`을 명시하도록 했다.
- `tests/vad-samples-overlap-default.test.js`를 추가해 core VAD 기본 overlap과 whisper.wasm VAD 경계 설정을 정적 검증한다.

## 검증 결과

- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp,app/emscripten.cpp tests/vad-samples-overlap-default.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/emscripten.cpp tests/whisper-wasm-vad-controls.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.

## 미검증 항목

- 실제 오디오에서 경계 단어 누락이나 중복 완화 효과는 브라우저 전사 결과로 확인해야 한다.
