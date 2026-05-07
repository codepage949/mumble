# 앱 소스 디렉터리 단순화

## 배경

- 현재 프로젝트에는 WASM 앱이 하나뿐이라 `app/whisper.wasm`처럼 앱 아래에 다시 앱 이름 디렉터리를 둘 필요가 없다.
- `whisper.wasm` 이름은 빌드 산출물 디렉터리에는 의미가 있지만, 소스 디렉터리 구조에서는 불필요한 중첩이었다.

## 구현

- `app/whisper.wasm/*` 파일을 `app/*`로 한 단계 올렸다.
- 루트 README와 중복되고 upstream 예제 설명이 남아 있던 `app/README.md`를 제거했다.
- 루트 `CMakeLists.txt`의 하위 빌드 경로를 `add_subdirectory(app)`으로 변경했다.
- 테스트, README, 변경 문서의 소스 경로 참조를 `app/...` 기준으로 갱신했다.
- 빌드 산출물 경로 `build-em/bin/whisper.wasm`은 배포 구조와 `deno task start` 흐름을 유지하기 위해 그대로 두었다.

## 테스트

- `deno task test`
- `cmake -S . -B build-check -G Ninja`
- `BUILD_DIR=build-em-submodule deno task build`
