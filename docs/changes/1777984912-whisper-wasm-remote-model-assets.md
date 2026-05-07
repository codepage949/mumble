# whisper.wasm 원격 모델 자산 사용

## 목표

- WASM 정적 산출물이 Whisper 모델과 VAD 모델 바이너리를 직접 포함하거나 서빙하지 않는다.
- 브라우저는 기존 모델 서빙 URL을 그대로 `fetch()`해 MEMFS의 `whisper.bin`, `vad.bin`에 적재한다.
- 모델 URL은 빌드 시 설정 가능하게 유지하고, 기본값은 기존에 다운로드하던 Hugging Face 주소로 둔다.
- 재방문 속도를 위해 원격 모델 응답은 계속 브라우저 Cache Storage에 저장한다.

## 구현 계획

1. `app/index-tmpl.html`에서 모델 자산 경로를 산출물 상대 경로가 아닌 빌드 주입 URL로 분리한다.
2. 모델 로딩 로그와 화면 문구에서 번들/정적 사이트 모델 표현을 원격 모델 URL 표현으로 바꾼다.
3. `app/CMakeLists.txt`에서 모델 파일 복사 옵션을 제거하고 모델 URL 문자열 옵션을 추가한다.
4. `scripts/build-whisper-wasm-static.sh`에서 모델 다운로드 단계를 제거하고, URL 옵션만 CMake에 전달한다.
5. 루트 README와 `app/README.md`의 빌드/산출물 설명을 원격 모델 사용 방식으로 갱신한다.
6. 핵심 로딩 설정은 정적 테스트로 검증한다.

## 테스트 계획

- 모델 URL이 HTML 템플릿에 빌드 변수로 남아 있고, 브라우저 캐시 키가 원격 URL을 사용하는지 테스트한다.
- 빌드 스크립트가 모델 파일 다운로드와 CMake 모델 파일 복사 옵션을 더 이상 사용하지 않는지 테스트한다.
- 기존 오디오 정규화 테스트를 함께 실행해 회귀가 없는지 확인한다.
- 셸 스크립트 문법 검사를 실행한다.

## 구현 내용

- `app/index-tmpl.html`은 `WHISPER_WASM_MODEL_URL`과 `WHISPER_WASM_VAD_MODEL_URL`로 주입된 URL을 직접 `fetch()`한다.
- 원격 URL 응답을 Cache Storage에 저장하고, 같은 URL 재방문 시 캐시 응답을 MEMFS의 `whisper.bin`, `vad.bin`으로 다시 적재한다.
- `app/CMakeLists.txt`에서 `WHISPER_WASM_MODEL_FILE`, `WHISPER_WASM_VAD_MODEL_FILE` 파일 복사 옵션을 제거했다.
- `scripts/build-whisper-wasm-static.sh`에서 모델 다운로드 단계를 제거하고 `MODEL_URL`, `VAD_MODEL_URL`만 CMake에 전달하도록 바꿨다.
- README 문서에서 산출물에 모델 바이너리가 포함되지 않는 점과 외부 모델 URL의 CORS 요구사항을 기록했다.
- `tests/whisper-wasm-remote-model-assets.test.js`를 추가해 원격 모델 URL 설정과 모델 파일 복사 제거를 정적 검증한다.

## 테스트 결과

- `deno test --allow-read tests/whisper-wasm-remote-model-assets.test.js tests/whisper-wasm-audio-utils.test.js` 통과.
- `bash -n scripts/build-whisper-wasm-static.sh` 통과.
