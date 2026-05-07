function assertIncludes(text, expected) {
    if (!text.includes(expected)) {
        throw new Error(`expected to include: ${expected}`);
    }
}

function assertNotIncludes(text, unexpected) {
    if (text.includes(unexpected)) {
        throw new Error(`expected not to include: ${unexpected}`);
    }
}

async function read(path) {
    return await Deno.readTextFile(path);
}

Deno.test({
    name: '모델 URL은 HTML 템플릿에 빌드 설정으로 주입된다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await read('app/index-tmpl.html');

        assertIncludes(html, "const kModelAssetUrl = '@WHISPER_WASM_MODEL_URL@';");
        assertIncludes(html, "const kVadModelAssetUrl = '@WHISPER_WASM_VAD_MODEL_URL@';");
        assertIncludes(html, "fetchModelAsset(kModelAssetUrl, 'model ' + kModelName)");
        assertIncludes(html, "fetchModelAsset(kVadModelAssetUrl, 'VAD model')");
        assertIncludes(html, 'cache.match(assetUrl)');
        assertIncludes(html, 'cache.put(assetUrl, response.clone())');
        assertNotIncludes(html, "const kModelAsset = 'whisper.bin';");
        assertNotIncludes(html, "const kVadModelAsset = 'vad.bin';");
    },
});

Deno.test({
    name: '웹페이지 title은 mumble이다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await read('app/index-tmpl.html');

        assertIncludes(html, '<title>mumble</title>');
        assertNotIncludes(html, '<title>whisper.cpp : WASM dropzone</title>');
    },
});

Deno.test({
    name: 'CMake는 모델 파일을 산출물에 복사하지 않는다',
    permissions: { read: ['app/CMakeLists.txt'] },
    fn: async () => {
        const cmake = await read('app/CMakeLists.txt');

        assertIncludes(cmake, 'WHISPER_WASM_MODEL_URL');
        assertIncludes(cmake, 'WHISPER_WASM_VAD_MODEL_URL');
        assertNotIncludes(cmake, 'WHISPER_WASM_MODEL_FILE');
        assertNotIncludes(cmake, 'WHISPER_WASM_VAD_MODEL_FILE');
        assertNotIncludes(cmake, '/whisper.bin COPYONLY');
        assertNotIncludes(cmake, '/vad.bin COPYONLY');
        assertNotIncludes(cmake, 'helpers.js');
    },
});

Deno.test({
    name: '웹페이지는 구버전 helpers.js 대신 필요한 로그 함수만 직접 가진다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await read('app/index-tmpl.html');

        assertIncludes(html, 'function printTextarea()');
        assertNotIncludes(html, 'src="helpers.js"');
        assertNotIncludes(html, 'loadRemote(');
        assertNotIncludes(html, 'IndexedDB');
    },
});

Deno.test({
    name: '정적 빌드 스크립트는 모델 다운로드 대신 URL만 전달한다',
    permissions: { read: ['scripts/build-whisper-wasm-static.sh'] },
    fn: async () => {
        const script = await read('scripts/build-whisper-wasm-static.sh');

        assertIncludes(script, '-DWHISPER_WASM_MODEL_URL="${MODEL_URL}"');
        assertIncludes(script, '-DWHISPER_WASM_VAD_MODEL_URL="${VAD_MODEL_URL}"');
        assertNotIncludes(script, 'MODEL_FILE=');
        assertNotIncludes(script, 'VAD_MODEL_FILE=');
        assertNotIncludes(script, 'download_file "${MODEL_URL}"');
        assertNotIncludes(script, 'download_file "${VAD_MODEL_URL}"');
        assertIncludes(script, 'BUILD_DIR="${ROOT_DIR}/${BUILD_DIR}"');
        assertIncludes(script, 'rm -rf "${BUILD_DIR}/bin/whisper.wasm"');
        assertIncludes(script, 'cp "${BUILD_DIR}/bin/libmain.js" "${BUILD_DIR}/bin/whisper.wasm/main.js"');
    },
});

Deno.test({
    name: 'Deno 서버는 실행 위치가 아니라 서버 파일 위치 기준으로 산출물을 서빙한다',
    permissions: { read: ['app/server.ts', 'deno.json'] },
    fn: async () => {
        const server = await read('app/server.ts');
        const config = await read('deno.json');

        assertIncludes(server, 'const fsRoot = import.meta.dirname ?? ".";');
        assertIncludes(server, 'fsRoot,');
        assertNotIncludes(server, 'fsRoot: ".",');
        assertIncludes(config, 'cd build-em/bin/whisper.wasm && deno run --allow-net --allow-read server.ts');
    },
});
