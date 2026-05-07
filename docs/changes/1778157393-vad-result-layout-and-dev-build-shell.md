# VAD 결과 레이아웃 안정화 및 개발 빌드 셸 호출 조정

## 목표

- VAD 구간 결과가 먼저 표시되고 각 구간 전사 텍스트가 순차 갱신될 때 화면 레이아웃이 흔들리지 않게 한다.
- 결과가 많아져도 페이지 전체 높이가 계속 변하지 않고 결과 목록 영역 안에서 스크롤되게 한다.
- 개발 서버 빌드 실행이 Windows 환경에서도 명시적으로 bash를 통해 셸 스크립트를 실행하게 한다.

## 구현 계획

1. `app/index-tmpl.html`의 오른쪽 결과 패널에 최소 높이와 내부 스크롤 영역을 지정한다.
2. 세그먼트 버튼의 시간 열을 고정 폭으로 바꿔 텍스트 갱신 중 열 너비 재계산을 줄인다.
3. 긴 전사 문장이 결과 패널 밖으로 밀려나지 않도록 텍스트 줄바꿈 규칙을 보강한다.
4. Deno 정적 테스트에 결과 패널 레이아웃 안정화 스타일 기대값을 추가한다.
5. `scripts/dev.ts`의 빌드 명령 실행 방식을 문서에 반영한다.

## 테스트 계획

- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js`

## 구현 내용

- `app/index-tmpl.html`의 오른쪽 결과 패널을 grid로 고정하고 최소 높이를 지정했다.
- `#segments`에 최소 높이, 최대 높이, 내부 세로 스크롤, 안정적인 scrollbar gutter를 적용했다.
- 세그먼트 버튼의 시간 열을 고정 폭으로 바꾸고, 긴 전사 문장은 결과 영역 안에서 줄바꿈되도록 했다.
- 모바일 단일 열 레이아웃에서는 결과 목록 최대 높이를 해제해 일반 페이지 스크롤 흐름을 유지했다.
- `tests/whisper-wasm-vad-controls.test.js`에 결과 패널 레이아웃 안정화 CSS 기대값을 추가했다.
- `scripts/dev.ts`는 `bash ./scripts/build-whisper-wasm-static.sh` 형태로 빌드 스크립트를 실행하도록 조정된 변경을 함께 포함했다.

## 테스트 결과

- `deno test --allow-read tests/whisper-wasm-vad-controls.test.js` 통과.
