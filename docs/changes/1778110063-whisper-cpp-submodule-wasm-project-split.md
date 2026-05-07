# whisper.cpp 서브모듈 기반 WASM 프로젝트 분리

## 계획

1. 루트에 섞여 있던 upstream `whisper.cpp` 소스와 mumble WASM 앱 코드를 분리한다.
2. `whisper.cpp`는 `external/whisper.cpp` 서브모듈로 고정한다.
3. WASM 앱 코드는 `app` 아래로 이동한다.
4. 루트 CMake는 서브모듈의 `whisper` 라이브러리를 불러와 WASM 앱만 빌드하게 구성한다.
5. 빌드 스크립트, README, 정적 테스트 경로를 새 구조에 맞춘다.

## 구현

- `external/whisper.cpp`를 `ggml-org/whisper.cpp` 서브모듈로 추가하고, 기존 WASM 작업의 기반 커밋인 `4bf733672b2871d4153158af4f621a6dd9104f4a`에 고정했다.
- 기존 `examples/whisper.wasm` 앱을 `app`으로 이동했다.
- 기존 `examples/helpers.js`를 `app/helpers.js`로 이동했다.
- 루트 `CMakeLists.txt`를 새로 구성해 `WHISPER_BUILD_TESTS`, `WHISPER_BUILD_EXAMPLES`, `WHISPER_BUILD_SERVER`를 끄고 서브모듈의 `whisper` 라이브러리와 WASM 앱만 빌드하게 했다.
- `app/CMakeLists.txt`에서 서브모듈의 `examples/miniaudio.h`를 include 경로로 사용하게 했다.
- `app` 타깃은 `embind` 요구사항에 맞춰 C++17로 컴파일하게 했다.
- 루트 CMake에 Emscripten pthread 컴파일/링크 플래그를 명시해 앱 오브젝트도 shared memory 요구사항을 만족하게 했다.
- `scripts/build-whisper-wasm-static.sh`에서 서브모듈이 없으면 초기화하고, `WHISPER_CPP_DIR`을 CMake에 전달하게 했다.
- README를 mumble 중심 구조 설명으로 다시 작성했다.
- Deno 정적 테스트의 파일 경로를 `app`과 `external/whisper.cpp` 기준으로 갱신했다.

## 테스트

- `deno test --allow-read tests/*.test.js`
- `bash -n scripts/build-whisper-wasm-static.sh`
- `cmake -S . -B build-check -G Ninja`
- `BUILD_DIR=build-em-submodule ./scripts/build-whisper-wasm-static.sh`
