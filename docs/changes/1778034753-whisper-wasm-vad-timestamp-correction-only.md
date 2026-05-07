# whisper.wasm VAD 기반 timestamp 보정 전용 적용

## 요청

- 1.5배속 전사 시도는 취소한다.
- VAD는 Whisper 입력 오디오를 줄이는 용도가 아니라, VAD 결과 speech 시간대를 기준으로 segment 앞뒤 무음 구간을 제거하는 보정 용도로만 사용한다.
- 전사는 원본 오디오 전체를 대상으로 수행해 처리 품질 저하를 피한다.

## 구현 계획

1. 미커밋 1.5배속 전사 변경을 되돌린다.
2. 브라우저가 VAD 모델을 다시 로드하도록 모델 URL과 preload 흐름을 복구한다.
3. wasm binding에서는 `whisper_full()` 전사 params의 `vad`는 계속 `false`로 유지한다.
4. 전사 완료 후 같은 원본 PCM에 VAD를 별도로 실행해 speech interval 목록을 얻는다.
5. 각 Whisper segment와 겹치는 VAD speech interval의 첫 시작과 마지막 끝으로 `t0`, `t1`을 모두 보정한다.
6. 보정된 인접 segment 사이의 gap이 0.3초 이하이면 하나의 segment로 병합한다.
7. 보정 전후 timestamp와 적용된 VAD speech 범위를 결과에 포함하고 브라우저 로그로 출력한다.
8. 정적 테스트와 WASM 빌드로 검증한다.

## 구현 내용

- 1.5배속 전사용 PCM 변경과 관련 테스트/문서를 취소했다.
- `app/index-tmpl.html`에서 VAD 모델 URL, preload, MEMFS 저장을 복구했다.
- UI에는 VAD 옵션 입력을 노출하지 않고, 전사 호출은 `Module.full_default(..., false, true, 0)`으로 보정용 VAD만 요청한다.
- `app/emscripten.cpp`에서 Whisper 전사용 `params.vad`는 계속 `false`로 고정했다.
- 전사 완료 후 원본 PCM에 대해 `whisper_vad_segments_from_samples()`를 별도로 실행한다.
- 보정용 VAD는 `whisper_vad_default_params()` 기본값을 사용해 VAD speech 구간이 기본 padding을 유지하게 했다.
- 각 Whisper segment와 겹치는 VAD speech interval을 찾고, 첫 speech 시작으로 `t0`를 늦추며 마지막 speech 끝으로 `t1`을 줄여 앞뒤 무음을 제거한다.
- 보정된 다음 segment의 `t0`와 이전 보정 segment의 `t1` 사이 gap이 30cs, 즉 0.3초 이하이면 두 segment의 시간과 텍스트를 병합해 경계가 너무 가까운 segment가 따로 재생되는 문제를 줄인다.
- 보정이 발생한 경우 segment index, raw `t0/t1`, corrected `t0/t1`, VAD speech 범위를 `vadCorrectionLogs`로 반환하고 브라우저 로그에 출력한다.
- 정적 빌드 스크립트와 CMake에 VAD 모델 URL 설정을 복구했다.
- README는 Whisper 모델과 VAD 모델 URL을 브라우저에서 런타임 fetch한다고 다시 설명하도록 갱신했다.

## 검증 결과

- `deno test --allow-read=app/index-tmpl.html,app/emscripten.cpp tests/whisper-wasm-vad-controls.test.js` 통과.
- `deno test --allow-read=external/whisper.cpp/src/whisper.cpp,app/emscripten.cpp tests/vad-samples-overlap-default.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html,app/CMakeLists.txt,scripts/build-whisper-wasm-static.sh tests/whisper-wasm-remote-model-assets.test.js` 통과.
- `deno test --allow-read=app/index-tmpl.html tests/whisper-wasm-segment-playback-precision.test.js` 통과.
- `deno test tests/whisper-wasm-audio-utils.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.
- 생성된 `build-em/bin/whisper.wasm/index-tmpl.html`에서 VAD 모델 로딩, 보정 로그, `Module.full_default(..., false, true, 0)` 호출이 반영된 것을 확인했다.
