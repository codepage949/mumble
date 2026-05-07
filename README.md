# mumble

`mumble`은 언어 학습용 음성 자료의 문장들을 대략 나누고, 구간을 반복해서 듣는 데
도움을 주는 브라우저 앱입니다. 정확한 자막 제작보다는 긴 음원을 학습하기 좋은
단위로 빠르게 쪼개는 데 초점을 둡니다.

전사와 음성 구간 처리는 `whisper.cpp`를 WASM으로 빌드해 브라우저 안에서 실행합니다.
프로젝트 루트에는 앱과 배포/테스트 코드만 두고, 원본 `whisper.cpp` 소스는
`external/whisper.cpp`에서 서브모듈로 관리합니다.

## 구조

```text
app/          # 브라우저 WASM 앱
external/whisper.cpp/      # upstream whisper.cpp submodule
scripts/                   # 빌드 스크립트
tests/                     # Deno 정적 테스트
docs/changes/              # 변경 기록
```

현재 앱은 `tiny-q8_0` 모델과 Silero VAD 모델을 원격 URL에서 받아 브라우저 안에서
실행합니다. 모델 바이너리는 배포 산출물에 포함하지 않습니다.

## 준비

처음 받은 저장소라면 서브모듈을 초기화합니다.

```bash
deno task submodule:init
```

## 빌드

저장소 루트에서 빌드 스크립트를 실행합니다.

```bash
deno task build
```

스크립트는 `.deps/emsdk` 아래의 emsdk를 설치하거나 재사용하고 Emscripten 빌드를
설정합니다. 배포 가능한 산출물은 다음 경로에 생성됩니다.

```text
build-em/bin/whisper.wasm/
```

주요 산출물은 다음과 같습니다.

```text
build-em/bin/whisper.wasm/index.html
build-em/bin/whisper.wasm/main.js
build-em/bin/whisper.wasm/audio-utils.js
build-em/bin/whisper.wasm/server.ts
```

기본 모델 URL은 다음과 같습니다.

```text
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q8_0.bin
https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin
```

다른 기존 서빙 주소를 사용하려면 빌드 시 환경변수를 지정합니다.

```bash
MODEL_URL=https://example.com/models/ggml-tiny-q8_0.bin \
VAD_MODEL_URL=https://example.com/models/ggml-silero-v6.2.0.bin \
deno task build
```

외부 모델 URL은 브라우저에서 CORS로 가져올 수 있어야 합니다.

## 로컬 실행

pthread가 활성화된 WASM 빌드는 브라우저에서 COOP/COEP 헤더가 필요합니다. 생성된
Deno 서버로 실행합니다.

```bash
deno task start
```

그 다음 아래 주소를 엽니다.

```text
http://localhost:8000/
```

## 테스트

```bash
deno task test
deno task check
```
