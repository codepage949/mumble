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

Deno.test({
    name: 'whisper.cpp 서브모듈의 VAD 기본 무음 감지 시간은 upstream 기본값을 유지한다',
    permissions: { read: ['external/whisper.cpp/src/whisper.cpp'] },
    fn: async () => {
        const source = await Deno.readTextFile('external/whisper.cpp/src/whisper.cpp');

        assertIncludes(source, '/* min_silence_duration_ms = */ 100,');
        assertNotIncludes(source, '/* min_silence_duration_ms = */ 300,');
    },
});

Deno.test({
    name: 'whisper.wasm은 whisper.cpp의 VAD filtered audio 구현에 의존하지 않는다',
    permissions: { read: ['app/emscripten.cpp'] },
    fn: async () => {
        const source = await Deno.readTextFile('app/emscripten.cpp');

        assertIncludes(source, 'whisper_vad_segments_from_samples(vctx, vad_params, samples, n_samples)');
        assertIncludes(source, 'append_vad_segments(vad_intervals, segments, vad_logs);');
        assertNotIncludes(source, 'make_vad_filtered_audio');
        assertNotIncludes(source, 'whisper_full_vad_segments');
    },
});
