# 루트 LICENSE 제거

## 배경

- 루트 `LICENSE`는 `ggml authors`의 MIT 라이선스 문구를 담고 있어, `mumble` 저장소 전체의 라이선스처럼 보일 수 있다.
- `whisper.cpp`는 서브모듈로 관리되며, 해당 라이선스 파일은 `external/whisper.cpp/LICENSE`에 유지된다.
- 현재는 `mumble` 자체의 라이선스를 별도로 명시하지 않기로 했다.

## 구현

- 루트 `LICENSE`를 제거한다.
- README에 `whisper.cpp` 라이선스는 서브모듈 내부 라이선스 파일을 따른다는 안내를 추가한다.
- `THIRD_PARTY_NOTICES`를 추가해 `whisper.cpp`와 ggml의 MIT 라이선스 고지를 별도로 보존한다.
- 빌드 산출물에도 `THIRD_PARTY_NOTICES`가 포함되도록 CMake 복사 대상을 추가한다.

## 테스트

- 사용자 요청에 따라 별도 테스트는 추가하지 않는다.
