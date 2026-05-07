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
        assertIncludes(html, "fetchModelAsset(kModelAssetUrl, '모델 ' + kModelName)");
        assertIncludes(html, "fetchModelAsset(kVadModelAssetUrl, 'VAD 모델')");
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
        assertIncludes(html, '<h1>mumble</h1>');
        assertNotIncludes(html, '<title>whisper.cpp : WASM dropzone</title>');
        assertNotIncludes(html, '<h1>whisper.cpp transcription</h1>');
    },
});

Deno.test({
    name: '웹페이지는 짧은 출처 문구와 분리된 상태 패널을 가진다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await read('app/index-tmpl.html');

        assertIncludes(html, '<div class="credit">Powered by whisper.cpp</div>');
        assertIncludes(html, '<strong>음성 파일을 여기에 놓으세요</strong>');
        assertIncludes(html, '<div class="status-panel" aria-live="polite">');
        assertIncludes(html, '<div class="status-label">상태</div>');
        assertIncludes(html, '<div id="status">준비됨</div>');
        assertIncludes(html, '<div id="progress"></div>');
        assertIncludes(html, '<h2 class="result-title">문장들</h2>');
        assertIncludes(html, '--surface: #ffffff;');
        assertIncludes(html, '--accent: #111111;');
        assertIncludes(html, 'min-height: 44px;');
        assertIncludes(html, 'background: var(--surface-muted);');
        assertIncludes(html, 'outline: 2px solid var(--focus);');
        assertNotIncludes(html, 'Model tiny-q8_0 is loaded from the configured model URL.');
        assertNotIncludes(html, 'Split speech into repeatable segments.');
        assertNotIncludes(html, 'Drop audio here');
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
    name: 'Deno 개발 태스크는 app 변경을 감시해 WASM 앱을 다시 빌드하고 서버를 띄운다',
    permissions: { read: ['deno.json', 'scripts/dev.ts'] },
    fn: async () => {
        const config = await read('deno.json');
        const script = await read('scripts/dev.ts');

        assertIncludes(config, '"dev": "deno run --allow-run --allow-env --allow-read scripts/dev.ts"');
        assertIncludes(script, 'new Deno.Command("./scripts/build-whisper-wasm-static.sh"');
        assertIncludes(script, 'stdout: "inherit"');
        assertIncludes(script, 'stderr: "inherit"');
        assertIncludes(script, 'cwd: "build-em/bin/whisper.wasm"');
        assertIncludes(script, 'args: ["run", "--allow-net", "--allow-read", "server.ts"]');
        assertIncludes(script, 'current.kill("SIGTERM");');
        assertIncludes(script, 'const watcher = Deno.watchFs("app");');
        assertIncludes(script, 'app/ changed. Rebuilding...');
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
