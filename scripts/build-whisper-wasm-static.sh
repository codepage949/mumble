#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMSDK_DIR="${EMSDK_DIR:-${ROOT_DIR}/.deps/emsdk}"
EMSDK_VERSION="${EMSDK_VERSION:-latest}"
BUILD_DIR="${BUILD_DIR:-${ROOT_DIR}/build-em}"
WHISPER_CPP_DIR="${WHISPER_CPP_DIR:-${ROOT_DIR}/external/whisper.cpp}"
MODEL_URL="${MODEL_URL:-https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q8_0.bin}"
VAD_MODEL_URL="${VAD_MODEL_URL:-https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin}"
NINJA_VERSION="${NINJA_VERSION:-v1.12.1}"
NINJA_DIR="${NINJA_DIR:-${ROOT_DIR}/.deps/ninja/${NINJA_VERSION}}"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"

case "${BUILD_DIR}" in
    /*) ;;
    *) BUILD_DIR="${ROOT_DIR}/${BUILD_DIR}" ;;
esac

case "${WHISPER_CPP_DIR}" in
    /*) ;;
    *) WHISPER_CPP_DIR="${ROOT_DIR}/${WHISPER_CPP_DIR}" ;;
esac

need_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "error: required command not found: $1" >&2
        exit 1
    fi
}

download_file() {
    local url="$1"
    local dst="$2"

    if [ -s "${dst}" ]; then
        return
    fi

    mkdir -p "$(dirname "${dst}")"

    if command -v curl >/dev/null 2>&1; then
        curl -L --fail --progress-bar "${url}" -o "${dst}"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "${dst}" "${url}"
    else
        echo "error: required command not found: curl or wget" >&2
        exit 1
    fi
}

need_command cmake
need_command git
need_command python3

if [ ! -f "${WHISPER_CPP_DIR}/CMakeLists.txt" ]; then
    git -C "${ROOT_DIR}" submodule update --init --recursive external/whisper.cpp
fi

resolve_emscripten_tool() {
    local name="$1"

    if command -v "${name}" >/dev/null 2>&1; then
        command -v "${name}"
        return
    fi

    if [ -x "${EMSDK_DIR}/upstream/emscripten/${name}.py" ]; then
        printf '%s\n' "${EMSDK_DIR}/upstream/emscripten/${name}.py"
        return
    fi

    if [ -f "${EMSDK_DIR}/upstream/emscripten/${name}.py" ]; then
        printf '%s\n' "${EMSDK_DIR}/upstream/emscripten/${name}.py"
        return
    fi

    return 1
}

has_cmake_generator_arg() {
    local arg
    for arg in "$@"; do
        if [ "${arg}" = "-G" ] || [[ "${arg}" == -G* ]]; then
            return 0
        fi
    done

    return 1
}

ensure_ninja() {
    if command -v ninja >/dev/null 2>&1; then
        return
    fi

    if [ -x "${NINJA_DIR}/ninja.exe" ]; then
        export PATH="${NINJA_DIR}:${PATH}"
        return
    fi

    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
            local zip_file="${NINJA_DIR}/ninja-win.zip"
            mkdir -p "${NINJA_DIR}"
            download_file "https://github.com/ninja-build/ninja/releases/download/${NINJA_VERSION}/ninja-win.zip" "${zip_file}"
            unzip -o -q "${zip_file}" -d "${NINJA_DIR}"
            export PATH="${NINJA_DIR}:${PATH}"
            ;;
        *)
            echo "error: ninja is required. Install ninja or pass an explicit CMake generator with -G." >&2
            exit 1
            ;;
    esac

    if ! command -v ninja >/dev/null 2>&1; then
        echo "error: ninja is still unavailable after setup" >&2
        exit 1
    fi
}

if ! resolve_emscripten_tool emcmake >/dev/null 2>&1; then
    if [ ! -d "${EMSDK_DIR}/.git" ]; then
        mkdir -p "$(dirname "${EMSDK_DIR}")"
        git clone https://github.com/emscripten-core/emsdk.git "${EMSDK_DIR}"
    else
        git -C "${EMSDK_DIR}" fetch --tags
    fi

    "${EMSDK_DIR}/emsdk" install "${EMSDK_VERSION}"
    "${EMSDK_DIR}/emsdk" activate "${EMSDK_VERSION}"
    # shellcheck source=/dev/null
    source "${EMSDK_DIR}/emsdk_env.sh" >/dev/null
fi

if ! command -v emcmake >/dev/null 2>&1 && [ -f "${EMSDK_DIR}/emsdk_env.sh" ]; then
    # shellcheck source=/dev/null
    source "${EMSDK_DIR}/emsdk_env.sh" >/dev/null
fi

EMCMAKE="$(resolve_emscripten_tool emcmake || true)"

if [ -z "${EMCMAKE}" ]; then
    echo "error: emcmake is still unavailable after emsdk setup" >&2
    exit 1
fi

mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"
rm -rf "${BUILD_DIR}/bin/whisper.wasm"

CMAKE_GENERATOR_ARGS=()
if ! has_cmake_generator_arg "$@"; then
    ensure_ninja
    CMAKE_GENERATOR_ARGS=(-G Ninja)
fi

"${EMCMAKE}" cmake "${ROOT_DIR}" \
    "${CMAKE_GENERATOR_ARGS[@]}" \
    -DWHISPER_CPP_DIR="${WHISPER_CPP_DIR}" \
    -DWHISPER_WASM_MODEL_URL="${MODEL_URL}" \
    -DWHISPER_WASM_VAD_MODEL_URL="${VAD_MODEL_URL}" \
    "$@"
cmake --build . --target libmain --parallel "${JOBS}"

if [ -f "${BUILD_DIR}/bin/libmain.js" ]; then
    mkdir -p "${BUILD_DIR}/bin/whisper.wasm"
    cp "${BUILD_DIR}/bin/libmain.js" "${BUILD_DIR}/bin/whisper.wasm/main.js"
fi

echo "Built static site: ${BUILD_DIR}/bin/whisper.wasm"
