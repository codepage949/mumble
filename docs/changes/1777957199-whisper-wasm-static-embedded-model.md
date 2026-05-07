# whisper.wasm 단일 드롭존 전사 및 정적 사이트 빌드

## 요청

- 기존 웹사이트 구현은 무시한다.
- 단일 파일 드롭존을 두고 파일을 드롭하면 `tiny-q8_0` 모델로 전사를 실행한다.
- 전사 결과를 페이지에 표시하고, 각 문장을 누르면 해당 구간의 사운드가 재생되게 한다.
- 언어 선택 콤보 박스를 표시한다.
- 모델은 `tiny-q8_0`만 사용한다.
- 모델은 Hugging Face에서 런타임에 다운로드하지 않고 정적 사이트 산출물에 포함한다.
- VAD 모델도 정적 사이트 산출물에 포함하고, 전사 시 항상 사용한다.
- Deno 단일 바이너리 빌드는 하지 않고, Deno Deploy 정적 사이트로 배포할 수 있는 wasm 웹페이지 산출물만 빌드한다.

## 구현 계획

1. `index-tmpl.html`을 `tiny-q8_0` 전용 드롭존 UI로 교체한다.
2. 빌드 시 Hugging Face에서 `ggml-tiny-q8_0.bin`을 다운로드하고 정적 산출물의 `whisper.bin`으로 복사한다.
3. 전사 결과를 문장별 버튼으로 표시하고, 클릭 시 저장된 오디오 URL에서 해당 구간만 재생한다.
4. `emscripten.cpp`의 `full_default` 바인딩은 전사를 worker thread에서 시작하고, `get_result` 바인딩으로 완료된 세그먼트를 조회한다.
5. CMake에 Whisper 모델과 VAD 모델 파일 복사 옵션을 추가한다.
6. README에 emsdk 설치부터 정적 wasm 페이지 빌드까지 한 번에 수행하는 방법을 기록한다.

## 테스트 계획

- HTML 전사 흐름과 내장 모델 사용 흐름을 정적 검사한다.
- C++ 바인딩 빌드가 통과하는지 확인한다.
- 정적 wasm 웹페이지 빌드가 성공하는지 확인한다.

## 구현 내용

- `app/index-tmpl.html`을 `tiny-q8_0` 전용 단일 파일 드롭존 화면으로 교체했다.
- 파일 드롭 또는 클릭 선택 시 오디오를 로드하고, 내장된 `/whisper.bin` 모델을 사용하도록 했다.
- 언어 선택 콤보 박스를 추가하고 선택한 언어 값을 전사 호출에 전달하도록 했다.
- 정적 산출물의 `/vad.bin` VAD 모델을 MEMFS에 항상 로드한 뒤 `whisper_full_params.vad`와 `vad_model_path`로 전사 호출에 전달하도록 했다.
- WASM 런타임 초기화 직후 `whisper.bin`과 `vad.bin`을 미리 로드하고, 브라우저 Cache Storage에 저장해 재방문 시 모델 네트워크 다운로드를 피하도록 했다.
- 모델과 VAD 로딩 중에는 전체 화면 진행률 오버레이를 표시하고, 완료 전까지 파일 선택/드롭/언어 선택 조작을 막도록 했다.
- `coi-serviceworker.js` 페이지 로드를 제거하고, Deno `server.ts`가 정적 파일을 서빙하며 COOP/COEP 헤더를 직접 붙이도록 했다.
- `coi-serviceworker.js`는 더 이상 정적 산출물에 복사하지 않도록 했다.
- 기존 브라우저에 등록된 COI 서비스워커는 페이지 진입 시 unregister만 수행하고 자동 reload는 하지 않도록 했다.
- 루트 `README.md` 상단에 현재 WASM 정적 전사 앱의 빌드, 로컬 실행, Deno Deploy 배포, 브라우저 캐시 동작을 추가하고 기존 upstream README를 별도 섹션으로 내렸다.
- Deno Deploy 공식 CLI 문서와 로컬 `--dry-run` 기준으로 `--source local`, `--runtime-mode dynamic`, `--entrypoint`, `--region`, `--do-not-use-detected-build-config` 사용이 맞는지 확인했고, 재사용 가능한 산출물에서는 앱별 `deno.json` deploy 설정을 생성하지 않도록 했다.
- 전사 결과를 세그먼트별 버튼으로 표시하고, 각 버튼 클릭 시 해당 시간 구간의 오디오를 재생하도록 했다.
- `app/emscripten.cpp`의 `full_default` 바인딩은 전사를 worker thread에서 시작하고, `get_result` 바인딩이 완료된 전사 세그먼트 배열을 반환하도록 변경했다.
- 브라우저 메인 스레드가 전사 중 멈추지 않도록 HTML에서 `get_result`를 주기적으로 polling하게 했다.
- `app/CMakeLists.txt`에 `WHISPER_WASM_MODEL_FILE`과 `WHISPER_WASM_VAD_MODEL_FILE` 옵션을 추가해 모델 파일을 정적 산출물 `whisper.bin`, `vad.bin`으로 복사할 수 있게 했다.
- `scripts/build-whisper-wasm-static.sh`를 추가해 emsdk 설치 또는 재사용, Whisper 모델과 VAD 모델 다운로드, 정적 wasm 페이지 빌드까지 한 번에 수행할 수 있게 했다.
- Deno 단일 바이너리 서버 소스와 빌드 스크립트는 제거했다.
- `app/README.md`에 정적 wasm 페이지 빌드와 배포 산출물 경로를 추가했다.
- `.gitignore`에 `.deps/`를 추가해 스크립트가 설치한 emsdk와 모델 의존성이 Git 변경 목록에 포함되지 않게 했다.

## 검증 결과

- `bash -n scripts/build-whisper-wasm-static.sh` 통과.
- `./scripts/build-whisper-wasm-static.sh` 실행 통과. 모델 다운로드, Emscripten CMake 설정, 모델 정적 파일 복사, `libmain.js` 빌드까지 완료했다.
- 정적 산출물 `build-em/bin/whisper.wasm/main.js`는 base64 single-file wasm으로 약 1.7 MB 생성되고, 모델은 `build-em/bin/whisper.wasm/whisper.bin` 약 42 MB, VAD 모델은 `build-em/bin/whisper.wasm/vad.bin` 약 865 KB 파일로 생성되는 것을 확인했다.
- `main.js` 안의 base64 wasm payload를 Node `WebAssembly.compile`로 검증했다.
- 정적 산출물 HTML에서 Hugging Face 런타임 다운로드/IndexedDB 경로가 제거되고 번들 모델 사용 흐름이 반영된 것을 확인했다.

## 미검증 항목

- 브라우저에서 실제 음성 전사는 수행하지 않았다.
