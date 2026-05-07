# whisper.wasm 웹페이지 title 변경

## 요청

- 웹페이지 브라우저 title을 `mumble`로 변경한다.

## 구현 계획

1. `app/index-tmpl.html`의 `<title>` 값을 `mumble`로 변경한다.
2. 정적 테스트에 title 검증을 추가한다.
3. 관련 테스트를 실행한다.

## 구현 내용

- `app/index-tmpl.html`의 `<title>`을 `mumble`로 변경했다.
- `tests/whisper-wasm-remote-model-assets.test.js`에 title 검증 테스트를 추가했다.

## 검증 결과

- `deno test --allow-read=app/index-tmpl.html,app/CMakeLists.txt,scripts/build-whisper-wasm-static.sh tests/whisper-wasm-remote-model-assets.test.js` 통과.
- `cmake --build build-em --target libmain -j 2` 통과.
- 생성된 `build-em/bin/whisper.wasm/index-tmpl.html`에서 `<title>mumble</title>` 반영을 확인했다.
