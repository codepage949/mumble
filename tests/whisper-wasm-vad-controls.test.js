function assertIncludes(text, expected) {
    if (!text.includes(expected)) {
        throw new Error(`expected to include: ${expected}`);
    }
}

Deno.test({
    name: '웹페이지는 VAD 옵션 노출 없이 VAD 전용 모델을 로드한다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await Deno.readTextFile('app/index-tmpl.html');

        if (html.includes('id="vad-min-silence"')) {
            throw new Error('expected not to expose VAD silence input');
        }
        if (html.includes('function getVadMinSilenceMs()')) {
            throw new Error('expected not to read VAD silence option');
        }
        assertIncludes(html, "const kVadModelAssetUrl = '@WHISPER_WASM_VAD_MODEL_URL@';");
        assertIncludes(html, 'function ensureVadModel()');
        assertIncludes(html, "fetchModelAsset(kVadModelAssetUrl, 'VAD 모델')");
        assertIncludes(html, 'await ensureVadModel();');
        assertIncludes(html, '<label for="vad-merge-gap">다음 간격의 문장은 합치기(초)</label>');
        assertIncludes(html, '<input type="number" id="vad-merge-gap" name="vad-merge-gap" min="0" max="5" step="0.1" value="0.5">');
        assertIncludes(html, 'const vadMergeGapEl = document.getElementById(\'vad-merge-gap\');');
        assertIncludes(html, 'vadMergeGapEl.disabled = locked;');
        assertIncludes(html, 'function getVadMergeGapMs()');
        assertIncludes(html, 'return Math.round(seconds*1000);');
        assertIncludes(html, 'Module.full_default(instance, audio, languageEl.value, nthreads, false, true, getVadMergeGapMs())');
        assertIncludes(html, 'Module.transcribe_segment(instance, audio, languageEl.value, nthreads, false, segment.t0, segment.t1, transcriptHint)');
        assertIncludes(html, 'logVadSegments(result.vadLogs || []);');
        assertIncludes(html, 'renderSegments(segments);');
        assertIncludes(html, 'await transcribeVadSegmentsSequentially(segments, runId, nthreads);');
        assertIncludes(html, "updateSegmentText(i, '...');");
        assertIncludes(html, 'updateSegmentText(i, transcribed);');
        assertIncludes(html, 'transcriptHint = (transcriptHint + \' \' + transcribed.trim()).trim();');
        assertIncludes(html, 'async function cancelActiveTranscription()');
        assertIncludes(html, 'Module.cancel();');
        assertIncludes(html, 'await waitForWorkerIdle();');
        assertIncludes(html, 'const runId = ++transcriptionRunId;');
        assertIncludes(html, 'if (runId !== transcriptionRunId)');
        assertIncludes(html, 'const kSegmentPlaybackLeadSeconds = 0.1;');
        assertIncludes(html, 'audioEl.currentTime = Math.max(0, segmentTimeSeconds(segment.t0) - kSegmentPlaybackLeadSeconds);');
        assertIncludes(html, 'js: VAD only: no speech segment detected');
        assertIncludes(html, 'js: VAD only: segment #');
        assertIncludes(html, 'grid-template-columns: max-content 1fr;');
        assertIncludes(html, 'align-items: center;');
        assertIncludes(html, 'white-space: nowrap;');
    },
});

Deno.test({
    name: 'WASM 바인딩은 STT 없이 VAD 구간만 빈 텍스트 세그먼트로 반환한다',
    permissions: { read: ['app/emscripten.cpp'] },
    fn: async () => {
        const source = await Deno.readTextFile('app/emscripten.cpp');

        assertIncludes(source, 'bool translate, bool vad, int vad_merge_gap_ms');
        assertIncludes(source, 'params.vad              = false;');
        assertIncludes(source, 'params.vad_model_path   = nullptr;');
        assertIncludes(source, 'detect_vad_intervals(pcmf32.data(), pcmf32.size(), vad_intervals)');
        assertIncludes(source, 'merge_vad_intervals(vad_intervals, vad_merge_gap_cs);');
        assertIncludes(source, 'append_vad_segments(vad_intervals, segments, vad_logs);');
        assertIncludes(source, 'interval.start,');
        assertIncludes(source, 'interval.end,');
        assertIncludes(source, '"",');
        assertIncludes(source, 'result.set("vadLogs", vad_logs);');
        assertIncludes(source, 'emscripten::function("transcribe_segment"');
        assertIncludes(source, 'const std::string & initial_prompt');
        assertIncludes(source, 'static const int64_t WHISPER_WASM_STT_PADDING_CS = 30;');
        assertIncludes(source, 'std::atomic<bool> g_worker_cancel(false);');
        assertIncludes(source, 'static bool whisper_wasm_should_abort(void * user_data)');
        assertIncludes(source, 'params.abort_callback = whisper_wasm_should_abort;');
        assertIncludes(source, 'params.encoder_begin_callback = whisper_wasm_encoder_begin_callback;');
        assertIncludes(source, 'g_worker_cancel.store(false);');
        assertIncludes(source, 'emscripten::function("cancel"');
        assertIncludes(source, 'g_worker_cancel.store(true);');
        assertIncludes(source, 'params.initial_prompt = initial_prompt.empty() ? nullptr : initial_prompt.c_str();');
        assertIncludes(source, '(t0 - WHISPER_WASM_STT_PADDING_CS)*WHISPER_SAMPLE_RATE/100');
        assertIncludes(source, '(t1 + WHISPER_WASM_STT_PADDING_CS)*WHISPER_SAMPLE_RATE/100');
        if (source.includes('transcribe_vad_interval(')) {
            throw new Error('expected not to transcribe each VAD interval');
        }
        if (source.includes('chunk(samples.begin()')) {
            throw new Error('expected not to copy VAD interval PCM chunks for STT');
        }
        if (source.includes('params.single_segment = true;')) {
            throw new Error('expected not to configure STT for VAD-only mode');
        }
        if (source.includes('whisper_full(ctx, params, chunk.data(), chunk.size())')) {
            throw new Error('expected not to call whisper_full for VAD intervals');
        }
        if (source.includes('params.vad_params.min_silence_duration_ms = vad_min_silence_ms;')) {
            throw new Error('expected not to pass VAD silence option');
        }
        if (source.includes('vad_min_silence_ms')) {
            throw new Error('expected not to keep unused VAD silence parameter');
        }
        if (source.includes('vadCorrectionLogs')) {
            throw new Error('expected not to keep obsolete VAD correction log name');
        }
        if (source.includes('rawT0') || source.includes('correctedT0')) {
            throw new Error('expected not to keep obsolete raw/corrected VAD log fields');
        }
    },
});

Deno.test({
    name: 'WASM 바인딩은 설정된 간격 미만의 VAD 구간을 병합한다',
    permissions: { read: ['app/emscripten.cpp'] },
    fn: async () => {
        const source = await Deno.readTextFile('app/emscripten.cpp');

        assertIncludes(source, 'static const int64_t WHISPER_WASM_DEFAULT_VAD_MERGE_GAP_CS = 50;');
        assertIncludes(source, 'static void merge_vad_intervals(std::vector<whisper_wasm_vad_interval> & intervals, int64_t merge_gap_cs)');
        assertIncludes(source, 'const int64_t vad_merge_gap_cs = vad_merge_gap_ms >= 0 ? vad_merge_gap_ms/10 : WHISPER_WASM_DEFAULT_VAD_MERGE_GAP_CS;');
        assertIncludes(source, 'interval.start - merged.back().end < merge_gap_cs');
        assertIncludes(source, 'merged.back().end = std::max(merged.back().end, interval.end);');
        assertIncludes(source, 'interval.start < merged.back().end');
    },
});
