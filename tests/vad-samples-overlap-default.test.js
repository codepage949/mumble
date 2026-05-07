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
    name: 'whisper.cpp 서브모듈의 VAD samples overlap은 upstream 기본값을 유지한다',
    permissions: { read: ['external/whisper.cpp/src/whisper.cpp'] },
    fn: async () => {
        const source = await Deno.readTextFile('external/whisper.cpp/src/whisper.cpp');

        assertIncludes(source, '/* samples_overlap         = */ 0.1,');
        assertNotIncludes(source, '/* samples_overlap         = */ 0.0f,');
    },
});

Deno.test({
    name: 'whisper.wasm은 전사에서 VAD를 사용하지 않는다',
    permissions: { read: ['app/emscripten.cpp'] },
    fn: async () => {
        const source = await Deno.readTextFile('app/emscripten.cpp');

        assertIncludes(source, 'params.vad              = false;');
        assertIncludes(source, 'params.vad_model_path   = nullptr;');
        assertNotIncludes(source, 'params.vad_params.speech_pad_ms = 0;');
        assertNotIncludes(source, 'params.vad_params.samples_overlap = 0.0f;');
        assertNotIncludes(source, 'whisper_full_vad_segments');
        assertNotIncludes(source, 'make_vad_filtered_audio');
        assertNotIncludes(source, 'whisper_full_get_segment_t0_raw');
        assertNotIncludes(source, 'result.set("playbackAudio"');
        assertNotIncludes(source, 'vad_params.speech_pad_ms = 0;');
        assertIncludes(source, 'whisper_vad_segments_from_samples(vctx, vad_params, samples, n_samples)');
        assertIncludes(source, 'append_vad_segments(vad_intervals, segments, vad_logs);');
    },
});
