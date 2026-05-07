# whisper.wasm MP3 결정적 디코더

## 요청

- MP3 입력에서 브라우저 `decodeAudioData()` 결과가 환경별로 달라져 `mono_checksum`과 VAD segment가 달라지는 문제를 줄인다.
- `ffmpeg.wasm` 대신 MP3 전용 deterministic decoder를 사용한다.
- 마지막 변경 문서를 갱신하지 않고 새 변경 문서로 기록한다.

## 구현 계획

1. WASM 바인딩에 repo 내 `miniaudio` MP3 디코더를 사용한 MP3 메모리 디코딩 함수를 추가한다.
2. JS 오디오 유틸에 interleaved PCM을 `AudioBuffer` 호환 객체로 바꾸는 유틸을 추가한다.
3. 파일 로딩 경로에서 MP3 전용 WASM 디코더를 먼저 시도하고, 실패한 경우에만 `decodeAudioData()`로 fallback한다.
4. 오디오 정규화 로그에 `decoder=mp3-wasm` 경로를 출력한다.
5. MP3 디코더 JS 변환 로직과 기존 오디오 정규화 로직을 테스트한다.

## 테스트 계획

- Deno 기반 단위 테스트로 interleaved MP3 디코딩 결과를 채널별 PCM으로 안정적으로 변환하는지 검증한다.
- Deno 기반 단위 테스트로 오디오 정규화 결정성 테스트가 계속 통과하는지 확인한다.
- C++ WASM 바인딩은 로컬에 MP3 fixture가 없으므로 빌드 또는 정적 검증으로 심볼과 호출 경로를 확인한다.

## 구현 내용

- `app/emscripten.cpp`에 `miniaudio` 기반 `decode_mp3` embind 함수를 추가했다.
- `decode_mp3`는 브라우저에서 넘긴 `Uint8Array` MP3 bytes를 WASM 메모리로 복사한 뒤 `ma_dr_mp3_open_memory_and_read_pcm_frames_f32()`로 interleaved float PCM을 생성한다.
- `decode_mp3`는 `sampleRate`, `numberOfChannels`, `length`, interleaved `Float32Array pcm`을 반환하고, 디코딩 실패 시 `null`을 반환한다.
- `app/audio-utils.js`에 `makeAudioBufferFromInterleaved()`를 추가해 WASM MP3 디코더 출력 PCM을 기존 오디오 정규화 함수가 사용하는 `AudioBuffer` 호환 객체로 변환하도록 했다.
- `app/index-tmpl.html`의 오디오 로딩 순서를 `MP3 WASM 디코더 -> decodeAudioData()` fallback으로 변경했다.
- 오디오 정규화 로그에 MP3 WASM 경로 사용 시 `decoder=mp3-wasm`이 출력되도록 했다.
- `tests/whisper-wasm-audio-utils.test.js`에 interleaved PCM을 채널별 PCM으로 변환하는 한글 테스트를 추가했다.
- MP3 WASM 디코더 성공 경로에 불필요한 이전 진단용 필드인 `monoChecksum`, `decodedDuration`, `durationHint`, `normalizedDurationMs`와 WAV 직접 파서를 제거했다.

## 검증 결과

- `deno test tests/whisper-wasm-audio-utils.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과. `app/emscripten.cpp`가 MP3 디코더 포함 상태로 컴파일되고 `bin/libmain.js` 링크가 완료되는 것을 확인했다.
- 빌드 산출물 `build-em/bin/libmain.js`와 `build-em/bin/whisper.wasm/main.js`가 약 1.8 MB로 생성되는 것을 확인했다.
- 실제 MP3 입력에서 `mp3-wasm` 경로가 동작하는 것을 확인했다.

## 미검증 항목

- 실제 브라우저 여러 환경에서 MP3 입력의 `decoder=mp3-wasm`, `source_rate`, `source_samples`, 최종 `checksum`이 모두 같아지는지는 아직 확인하지 않았다.
- 로컬에 MP3 fixture가 없어 C++ `decode_mp3`의 실제 MP3 decode 결과를 단위 테스트로 비교하지는 못했다.
- MP3 외 AAC, M4A, Opus 등은 여전히 `decodeAudioData()` fallback 경로를 사용하므로 브라우저/OS 디코더 차이가 남을 수 있다.
