# whisper.wasm 브라우저 오디오 리샘플 차이 축소

## 요청

- 동일한 입력 파일을 웹사이트에서 전사했을 때 환경별 샘플 수가 1개 차이 나는 문제를 줄인다.
- VAD는 항상 켜진 상태를 유지한다.
- 브라우저 `decodeAudioData()` 이후 자체 JS 리샘플러로 16 kHz mono PCM을 만들어 환경별 차이를 줄인다.

## 구현 계획

1. `app`에 오디오 정규화 유틸 JS를 추가한다.
2. 디코딩된 `AudioBuffer`를 채널 평균 mono로 변환한다.
3. 자체 deterministic 리샘플러로 16 kHz PCM을 생성한다.
4. 목표 샘플 수는 `AudioBuffer.duration * 16000` 기준으로 계산해 브라우저별 `decoded.length` 차이를 완화한다.
5. 웹페이지는 `OfflineAudioContext` 리샘플 대신 새 유틸을 사용한다.
6. Whisper 입력 PCM 길이와 checksum을 로그로 출력해 환경별 입력 동일 여부를 확인할 수 있게 한다.
7. 오디오 정규화 핵심 로직에 한글 테스트를 추가하고 통과를 확인한다.
8. Windows Git Bash에서 정적 사이트 빌드 스크립트가 emsdk 설치 후 `emcmake`와 CMake generator를 안정적으로 찾도록 보강한다.

## 테스트 계획

- Deno 기반 단위 테스트로 리샘플 목표 길이 계산, mono 믹싱, 리샘플 결과 결정성을 검증한다.
- HTML 정적 산출물에 새 오디오 유틸 파일이 복사되는지 CMake 설정을 정적 확인한다.

## 구현 내용

- `app/audio-utils.js`를 추가해 브라우저와 테스트가 같은 오디오 정규화 함수를 사용하도록 했다.
- `AudioBuffer` 채널을 평균 내어 mono PCM으로 변환하도록 했다.
- 자체 linear 리샘플러로 target sample rate PCM을 생성하도록 했다.
- 목표 샘플 수는 media element duration hint를 우선 사용하고, 밀리초 단위로 반올림한 뒤 16 kHz 샘플 수로 변환하도록 했다. 이로써 환경별 디코딩 결과가 1 샘플 정도 흔들리는 경우 Whisper 입력 길이가 같아지도록 했다.
- `app/index-tmpl.html`에서 `OfflineAudioContext` 리샘플링을 제거하고 새 오디오 정규화 유틸을 사용하도록 바꿨다.
- 전사 전 로그에 source sample rate, source sample count, target sample count, checksum을 출력해 환경별 Whisper 입력 차이를 확인할 수 있게 했다.
- `app/CMakeLists.txt`에서 정적 산출물에 `audio-utils.js`를 복사하도록 했다.
- `tests/whisper-wasm-audio-utils.test.js`를 추가해 오디오 정규화 핵심 로직을 검증했다.
- `scripts/build-whisper-wasm-static.sh`가 Windows emsdk의 `emcmake.py` fallback을 사용하도록 했다.
- 빌드 도구가 없는 Windows Git Bash 환경에서는 Ninja를 `.deps` 아래에 내려받고 CMake generator로 `Ninja`를 명시하도록 했다.
- 사용자가 `-G`로 CMake generator를 직접 넘기면 스크립트의 Ninja 자동 지정은 건너뛰도록 했다.

## 검증 결과

- `deno test tests/whisper-wasm-audio-utils.test.js` 통과.
- `rg`로 `audio-utils.js`가 HTML에서 로드되고 CMake 정적 산출물에 복사되는 것을 확인했다.
- `bash -n scripts/build-whisper-wasm-static.sh` 통과.
- `bash scripts/build-whisper-wasm-static.sh` 통과. Windows Git Bash에서 Ninja 자동 설치, Emscripten CMake 설정, `libmain.js` 빌드, 정적 산출물 생성을 확인했다.
- 정적 산출물 `build-em/bin/whisper.wasm`에 `index-tmpl.html`, `audio-utils.js`, `main.js`, `whisper.bin`, `vad.bin`이 생성된 것을 확인했다.

## 미검증 항목

- 브라우저에서 동일 입력 파일을 여러 환경에 넣어 checksum이 같아지는지는 아직 확인하지 않았다.
