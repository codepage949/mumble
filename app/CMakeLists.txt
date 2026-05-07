#
# libmain
#

set(TARGET libmain)

add_executable(${TARGET}
    emscripten.cpp
    )

include(DefaultTargetOptions)

target_compile_features(${TARGET} PRIVATE
    cxx_std_17
    )

target_include_directories(${TARGET} PRIVATE
    ${WHISPER_CPP_DIR}/examples
    )

target_link_libraries(${TARGET} PRIVATE
    whisper
    )

unset(EXTRA_FLAGS)

set(WHISPER_WASM_MODEL_URL "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q8_0.bin" CACHE STRING "whisper.wasm model URL to fetch in the browser")
set(WHISPER_WASM_VAD_MODEL_URL "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin" CACHE STRING "whisper.wasm VAD model URL to fetch in the browser")

if (WHISPER_WASM_SINGLE_FILE)
    set(EXTRA_FLAGS "-s SINGLE_FILE=1 -s SINGLE_FILE_BINARY_ENCODE=0")
    message(STATUS "Embedding WASM inside main.js")

    add_custom_command(
        TARGET ${TARGET} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        ${CMAKE_BINARY_DIR}/bin/libmain.js
        ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/whisper.wasm/main.js
        )
endif()

set_target_properties(${TARGET} PROPERTIES LINK_FLAGS " \
    --bind \
    -s USE_PTHREADS=1 \
    -s PTHREAD_POOL_SIZE_STRICT=0 \
    -s INITIAL_MEMORY=512MB \
    -s MAXIMUM_MEMORY=2000MB \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_RUNTIME_METHODS=\"['print', 'printErr', 'ccall', 'cwrap', 'HEAPU8']\" \
    ${EXTRA_FLAGS} \
    ")

#
# whisper.wasm
#

set(TARGET whisper.wasm)

configure_file(${CMAKE_CURRENT_SOURCE_DIR}/index-tmpl.html  ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/${TARGET}/index.html @ONLY)
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/audio-utils.js    ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/${TARGET}/audio-utils.js COPYONLY)
configure_file(${CMAKE_CURRENT_SOURCE_DIR}/server.ts ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/${TARGET}/server.ts COPYONLY)
