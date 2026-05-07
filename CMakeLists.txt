cmake_minimum_required(VERSION 3.16)
project(mumble-whisper-wasm C CXX)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

if (NOT XCODE AND NOT MSVC AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
    set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS "Debug" "Release" "MinSizeRel" "RelWithDebInfo")
endif()

if (EMSCRIPTEN)
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -pthread")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s TOTAL_STACK=5242880")
endif()

set(WHISPER_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/external/whisper.cpp" CACHE PATH "Path to whisper.cpp checkout")

if (NOT EXISTS "${WHISPER_CPP_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "whisper.cpp source was not found at ${WHISPER_CPP_DIR}. Run: git submodule update --init --recursive")
endif()

set(WHISPER_BUILD_TESTS OFF CACHE BOOL "whisper: build tests" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "whisper: build examples" FORCE)
set(WHISPER_BUILD_SERVER OFF CACHE BOOL "whisper: build server example" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "build shared libraries" FORCE)

list(APPEND CMAKE_MODULE_PATH "${WHISPER_CPP_DIR}/cmake")

add_subdirectory("${WHISPER_CPP_DIR}" "${CMAKE_BINARY_DIR}/whisper.cpp")
add_subdirectory(app)
