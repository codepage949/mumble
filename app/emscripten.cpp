#include "whisper.h"

#define MA_NO_DEVICE_IO
#define MA_NO_THREADING
#define MA_NO_ENCODING
#define MA_NO_GENERATION
#define MA_NO_RESOURCE_MANAGER
#define MA_NO_NODE_GRAPH
#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"

#include <emscripten.h>
#include <emscripten/bind.h>

#include <algorithm>
#include <atomic>
#include <mutex>
#include <thread>
#include <vector>

std::thread g_worker;

std::vector<struct whisper_context *> g_contexts(4, nullptr);

struct whisper_wasm_segment {
    int64_t     t0;
    int64_t     t1;
    std::string text;
};

struct whisper_wasm_vad_log {
    int     index;
    int64_t start;
    int64_t end;
};

std::atomic<bool> g_worker_done(true);
std::atomic<bool> g_worker_cancel(false);
std::mutex g_worker_mutex;
int g_worker_error = 0;
std::vector<whisper_wasm_segment> g_worker_segments;
std::vector<whisper_wasm_vad_log> g_worker_vad_logs;

static inline int mpow2(int n) {
    int p = 1;
    while (p <= n) p *= 2;
    return p/2;
}

struct whisper_wasm_vad_interval {
    int64_t start;
    int64_t end;
};

static const int64_t WHISPER_WASM_DEFAULT_VAD_MERGE_GAP_CS = 50;
static const int64_t WHISPER_WASM_STT_PADDING_CS = 30;

static bool whisper_wasm_should_abort(void * user_data) {
    return ((std::atomic<bool> *) user_data)->load();
}

static bool whisper_wasm_encoder_begin_callback(struct whisper_context *, struct whisper_state *, void * user_data) {
    return !whisper_wasm_should_abort(user_data);
}

static bool detect_vad_intervals(
        const float * samples,
        int n_samples,
        std::vector<whisper_wasm_vad_interval> & intervals) {
    intervals.clear();

    struct whisper_vad_context_params vad_ctx_params = whisper_vad_default_context_params();
    struct whisper_vad_context * vctx = whisper_vad_init_from_file_with_params("vad.bin", vad_ctx_params);
    if (vctx == nullptr) {
        return false;
    }

    struct whisper_vad_params vad_params = whisper_vad_default_params();
    struct whisper_vad_segments * vad_segments = whisper_vad_segments_from_samples(vctx, vad_params, samples, n_samples);
    whisper_vad_free(vctx);
    if (vad_segments == nullptr) {
        return false;
    }

    const int n_segments = whisper_vad_segments_n_segments(vad_segments);
    intervals.reserve(n_segments);
    for (int i = 0; i < n_segments; ++i) {
        const int64_t start = (int64_t)(whisper_vad_segments_get_segment_t0(vad_segments, i) + 0.5f);
        const int64_t end   = (int64_t)(whisper_vad_segments_get_segment_t1(vad_segments, i) + 0.5f);
        if (end > start) {
            intervals.push_back({ start, end });
        }
    }

    whisper_vad_free_segments(vad_segments);
    return true;
}

static void merge_vad_intervals(std::vector<whisper_wasm_vad_interval> & intervals, int64_t merge_gap_cs) {
    if (intervals.empty()) {
        return;
    }

    std::vector<whisper_wasm_vad_interval> merged;
    merged.reserve(intervals.size());

    for (const auto & interval : intervals) {
        if (!merged.empty() && interval.start >= merged.back().end && interval.start - merged.back().end < merge_gap_cs) {
            merged.back().end = std::max(merged.back().end, interval.end);
            continue;
        }
        if (!merged.empty() && interval.start < merged.back().end) {
            merged.back().end = std::max(merged.back().end, interval.end);
            continue;
        }
        merged.push_back(interval);
    }

    intervals = std::move(merged);
}

static void append_vad_segments(
        const std::vector<whisper_wasm_vad_interval> & intervals,
        std::vector<whisper_wasm_segment> & segments,
        std::vector<whisper_wasm_vad_log> & logs) {
    for (int i = 0; i < (int) intervals.size(); ++i) {
        const whisper_wasm_vad_interval & interval = intervals[i];
        segments.push_back({
            interval.start,
            interval.end,
            "",
        });
        logs.push_back({
            i,
            interval.start,
            interval.end,
        });
    }
}

EMSCRIPTEN_BINDINGS(whisper) {
    emscripten::function("decode_mp3", emscripten::optional_override([](const emscripten::val & bytes) {
        const int n = bytes["length"].as<int>();
        if (n <= 0) {
            return emscripten::val::null();
        }

        std::vector<uint8_t> mp3;
        mp3.resize(n);

        emscripten::val heap = emscripten::val::module_property("HEAPU8");
        emscripten::val memory = heap["buffer"];
        emscripten::val memoryView = bytes["constructor"].new_(memory, reinterpret_cast<uintptr_t>(mp3.data()), n);
        memoryView.call<void>("set", bytes);

        ma_dr_mp3_config config = {};
        ma_uint64 frame_count = 0;
        float * pcm = ma_dr_mp3_open_memory_and_read_pcm_frames_f32(mp3.data(), mp3.size(), &config, &frame_count, nullptr);
        if (pcm == nullptr || config.channels == 0 || config.sampleRate == 0 || frame_count == 0) {
            if (pcm != nullptr) {
                ma_dr_mp3_free(pcm, nullptr);
            }
            return emscripten::val::null();
        }

        const size_t sample_count = (size_t) frame_count * config.channels;
        emscripten::val result = emscripten::val::object();
        result.set("sampleRate", config.sampleRate);
        result.set("numberOfChannels", config.channels);
        result.set("length", (double) frame_count);
        result.set("pcm", emscripten::val::global("Float32Array").new_(emscripten::typed_memory_view(sample_count, pcm)));

        ma_dr_mp3_free(pcm, nullptr);

        return result;
    }));

    emscripten::function("init", emscripten::optional_override([](const std::string & path_model) {
        if (g_worker.joinable()) {
            g_worker.join();
        }

        for (size_t i = 0; i < g_contexts.size(); ++i) {
            if (g_contexts[i] == nullptr) {
                g_contexts[i] = whisper_init_from_file_with_params(path_model.c_str(), whisper_context_default_params());
                if (g_contexts[i] != nullptr) {
                    return i + 1;
                } else {
                    return (size_t) 0;
                }
            }
        }

        return (size_t) 0;
    }));

    emscripten::function("free", emscripten::optional_override([](size_t index) {
        if (g_worker.joinable()) {
            g_worker.join();
        }

        --index;

        if (index < g_contexts.size()) {
            whisper_free(g_contexts[index]);
            g_contexts[index] = nullptr;
        }
    }));

    emscripten::function("full_default", emscripten::optional_override([](size_t index, const emscripten::val & audio, const std::string & lang, int nthreads, bool translate, bool vad, int vad_merge_gap_ms) {
        if (g_worker.joinable()) {
            if (!g_worker_done.load()) {
                emscripten::val result = emscripten::val::object();
                result.set("error", -3);
                return result;
            }
            g_worker.join();
        }

        --index;

        if (index >= g_contexts.size()) {
            emscripten::val result = emscripten::val::object();
            result.set("error", -1);
            return result;
        }

        if (g_contexts[index] == nullptr) {
            emscripten::val result = emscripten::val::object();
            result.set("error", -2);
            return result;
        }

        struct whisper_full_params params = whisper_full_default_params(whisper_sampling_strategy::WHISPER_SAMPLING_GREEDY);
        bool is_multilingual = whisper_is_multilingual(g_contexts[index]);

        params.print_realtime   = true;
        params.print_progress   = false;
        params.print_timestamps = true;
        params.print_special    = false;
        params.translate        = translate;
        params.language         = is_multilingual ? strdup(lang.c_str()) : "en";
        params.n_threads        = std::min(nthreads, std::min(16, mpow2(std::thread::hardware_concurrency())));
        params.offset_ms        = 0;
        params.vad              = false;
        params.vad_model_path   = nullptr;
        params.encoder_begin_callback = whisper_wasm_encoder_begin_callback;
        params.encoder_begin_callback_user_data = &g_worker_cancel;
        params.abort_callback = whisper_wasm_should_abort;
        params.abort_callback_user_data = &g_worker_cancel;

        std::vector<float> pcmf32;
        const int n = audio["length"].as<int>();

        emscripten::val heap = emscripten::val::module_property("HEAPU8");
        emscripten::val memory = heap["buffer"];

        pcmf32.resize(n);

        emscripten::val memoryView = audio["constructor"].new_(memory, reinterpret_cast<uintptr_t>(pcmf32.data()), n);
        memoryView.call<void>("set", audio);

        // print system information
        {
            printf("system_info: n_threads = %d / %d | %s\n",
                    params.n_threads, std::thread::hardware_concurrency(), whisper_print_system_info());

            printf("%s: processing %d samples, %.1f sec, %d threads, %d processors, lang = %s, task = %s ...\n",
                    __func__, int(pcmf32.size()), float(pcmf32.size())/WHISPER_SAMPLE_RATE,
                    params.n_threads, 1,
                    params.language,
                    params.translate ? "translate" : "transcribe");

            printf("%s: vad = %s\n", __func__, params.vad ? "true" : "false");

            printf("\n");
        }

        {
            std::lock_guard<std::mutex> lock(g_worker_mutex);
            g_worker_error = 0;
            g_worker_segments.clear();
            g_worker_vad_logs.clear();
        }
        g_worker_cancel.store(false);
        g_worker_done.store(false);

        const int64_t vad_merge_gap_cs = vad_merge_gap_ms >= 0 ? vad_merge_gap_ms/10 : WHISPER_WASM_DEFAULT_VAD_MERGE_GAP_CS;

        g_worker = std::thread([index, params, pcmf32 = std::move(pcmf32), is_multilingual, vad, vad_merge_gap_cs]() {
            whisper_reset_timings(g_contexts[index]);

            std::vector<whisper_wasm_segment> segments;
            std::vector<whisper_wasm_vad_log> vad_logs;
            int ret = 0;
            if (vad) {
                std::vector<whisper_wasm_vad_interval> vad_intervals;
                if (!detect_vad_intervals(pcmf32.data(), pcmf32.size(), vad_intervals)) {
                    ret = -4;
                }
                if (ret == 0) {
                    merge_vad_intervals(vad_intervals, vad_merge_gap_cs);
                    append_vad_segments(vad_intervals, segments, vad_logs);
                }
            } else {
                ret = whisper_full(g_contexts[index], params, pcmf32.data(), pcmf32.size());
                if (ret == 0) {
                    const int n_segments = whisper_full_n_segments(g_contexts[index]);
                    for (int i = 0; i < n_segments; ++i) {
                        whisper_wasm_segment segment = {
                            whisper_full_get_segment_t0(g_contexts[index], i),
                            whisper_full_get_segment_t1(g_contexts[index], i),
                            whisper_full_get_segment_text(g_contexts[index], i),
                        };
                        segments.push_back(segment);
                    }
                }
            }
            whisper_print_timings(g_contexts[index]);

            if (is_multilingual) {
                free((void*)params.language);
            }

            {
                std::lock_guard<std::mutex> lock(g_worker_mutex);
                g_worker_error = ret;
                g_worker_segments = std::move(segments);
                g_worker_vad_logs = std::move(vad_logs);
            }
            g_worker_done.store(true);
        });

        emscripten::val result = emscripten::val::object();
        result.set("error", 0);
        result.set("started", true);

        return result;
    }));

    emscripten::function("transcribe_segment", emscripten::optional_override([](size_t index, const emscripten::val & audio, const std::string & lang, int nthreads, bool translate, int64_t t0, int64_t t1, const std::string & initial_prompt) {
        if (g_worker.joinable()) {
            if (!g_worker_done.load()) {
                emscripten::val result = emscripten::val::object();
                result.set("error", -3);
                return result;
            }
            g_worker.join();
        }

        --index;

        if (index >= g_contexts.size()) {
            emscripten::val result = emscripten::val::object();
            result.set("error", -1);
            return result;
        }

        if (g_contexts[index] == nullptr) {
            emscripten::val result = emscripten::val::object();
            result.set("error", -2);
            return result;
        }

        struct whisper_full_params params = whisper_full_default_params(whisper_sampling_strategy::WHISPER_SAMPLING_GREEDY);
        bool is_multilingual = whisper_is_multilingual(g_contexts[index]);

        params.print_realtime   = false;
        params.print_progress   = false;
        params.print_timestamps = false;
        params.print_special    = false;
        params.translate        = translate;
        params.language         = is_multilingual ? strdup(lang.c_str()) : "en";
        params.n_threads        = std::min(nthreads, std::min(16, mpow2(std::thread::hardware_concurrency())));
        params.offset_ms        = 0;
        params.duration_ms      = 0;
        params.vad              = false;
        params.vad_model_path   = nullptr;
        params.encoder_begin_callback = whisper_wasm_encoder_begin_callback;
        params.encoder_begin_callback_user_data = &g_worker_cancel;
        params.abort_callback = whisper_wasm_should_abort;
        params.abort_callback_user_data = &g_worker_cancel;

        std::vector<float> pcmf32;
        const int n = audio["length"].as<int>();

        emscripten::val heap = emscripten::val::module_property("HEAPU8");
        emscripten::val memory = heap["buffer"];

        pcmf32.resize(n);

        emscripten::val memoryView = audio["constructor"].new_(memory, reinterpret_cast<uintptr_t>(pcmf32.data()), n);
        memoryView.call<void>("set", audio);

        const int64_t start_sample = std::max<int64_t>(0, (t0 - WHISPER_WASM_STT_PADDING_CS)*WHISPER_SAMPLE_RATE/100);
        const int64_t end_sample = std::min<int64_t>((int64_t) pcmf32.size(), (t1 + WHISPER_WASM_STT_PADDING_CS)*WHISPER_SAMPLE_RATE/100);

        {
            std::lock_guard<std::mutex> lock(g_worker_mutex);
            g_worker_error = 0;
            g_worker_segments.clear();
            g_worker_vad_logs.clear();
        }
        g_worker_cancel.store(false);
        g_worker_done.store(false);

        g_worker = std::thread([index, params, pcmf32 = std::move(pcmf32), is_multilingual, t0, t1, start_sample, end_sample, initial_prompt]() mutable {
            whisper_reset_timings(g_contexts[index]);
            params.initial_prompt = initial_prompt.empty() ? nullptr : initial_prompt.c_str();

            std::vector<whisper_wasm_segment> segments;
            int ret = 0;
            if (end_sample > start_sample) {
                std::vector<float> chunk(pcmf32.begin() + start_sample, pcmf32.begin() + end_sample);
                ret = whisper_full(g_contexts[index], params, chunk.data(), chunk.size());
                if (ret == 0) {
                    std::string text;
                    const int n_segments = whisper_full_n_segments(g_contexts[index]);
                    for (int i = 0; i < n_segments; ++i) {
                        text += whisper_full_get_segment_text(g_contexts[index], i);
                    }
                    segments.push_back({
                        t0,
                        t1,
                        text,
                    });
                }
            }
            whisper_print_timings(g_contexts[index]);

            if (is_multilingual) {
                free((void*)params.language);
            }

            {
                std::lock_guard<std::mutex> lock(g_worker_mutex);
                g_worker_error = ret;
                g_worker_segments = std::move(segments);
                g_worker_vad_logs.clear();
            }
            g_worker_done.store(true);
        });

        emscripten::val result = emscripten::val::object();
        result.set("error", 0);
        result.set("started", true);

        return result;
    }));

    emscripten::function("cancel", emscripten::optional_override([]() {
        g_worker_cancel.store(true);
        emscripten::val result = emscripten::val::object();
        result.set("error", 0);
        result.set("cancelled", true);
        result.set("ready", g_worker_done.load());
        return result;
    }));

    emscripten::function("get_result", emscripten::optional_override([]() {
        emscripten::val result = emscripten::val::object();
        if (!g_worker_done.load()) {
            result.set("ready", false);
            return result;
        }

        if (g_worker.joinable()) {
            g_worker.join();
        }

        result.set("ready", true);

        emscripten::val segments = emscripten::val::array();
        emscripten::val vad_logs = emscripten::val::array();
        {
            std::lock_guard<std::mutex> lock(g_worker_mutex);
            result.set("error", g_worker_error);
            for (size_t i = 0; i < g_worker_segments.size(); ++i) {
                emscripten::val segment = emscripten::val::object();
                segment.set("t0", g_worker_segments[i].t0);
                segment.set("t1", g_worker_segments[i].t1);
                segment.set("text", g_worker_segments[i].text);
                segments.call<void>("push", segment);
            }
            for (size_t i = 0; i < g_worker_vad_logs.size(); ++i) {
                emscripten::val log = emscripten::val::object();
                log.set("index", g_worker_vad_logs[i].index);
                log.set("start", g_worker_vad_logs[i].start);
                log.set("end", g_worker_vad_logs[i].end);
                vad_logs.call<void>("push", log);
            }
        }
        result.set("segments", segments);
        result.set("vadLogs", vad_logs);

        return result;
    }));
}
