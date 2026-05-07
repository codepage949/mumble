import '../app/audio-utils.js';

const audio = globalThis.WhisperWasmAudio;

function assertEqual(actual, expected) {
    if (actual !== expected) {
        throw new Error(`expected ${expected}, got ${actual}`);
    }
}

function assertArrayEqual(actual, expected) {
    const actualArray = Array.from(actual);
    if (actualArray.length !== expected.length) {
        throw new Error(`expected length ${expected.length}, got ${actualArray.length}`);
    }

    for (let i = 0; i < expected.length; i++) {
        if (!Object.is(actualArray[i], expected[i])) {
            throw new Error(`expected[${i}] ${expected[i]}, got ${actualArray[i]}`);
        }
    }
}

function makeAudioBuffer(channels, sampleRate, duration) {
    const length = channels[0] ? channels[0].length : 0;
    return {
        duration,
        length,
        numberOfChannels: channels.length,
        sampleRate,
        getChannelData(index) {
            return channels[index];
        },
    };
}

Deno.test('목표 샘플 수는 밀리초 단위 duration으로 안정화된다', () => {
    const left = makeAudioBuffer([new Float32Array(16000)], 16000, 1);
    const right = makeAudioBuffer([new Float32Array(16001)], 16000, 1.0000625);

    assertEqual(audio.getTargetSampleCount(left, 16000), 16000);
    assertEqual(audio.getTargetSampleCount(right, 16000), 16000);
});

Deno.test('여러 채널 입력은 평균 mono PCM으로 변환된다', () => {
    const buffer = makeAudioBuffer([
        new Float32Array([1, 0.5, -0.5]),
        new Float32Array([-1, 0.5, 0.5]),
    ], 16000, 0.0001875);

    assertArrayEqual(audio.mixAudioBufferToMono(buffer), [0, 0.5, 0]);
});

Deno.test('interleaved PCM은 채널별 AudioBuffer 형태로 변환된다', () => {
    const buffer = audio.makeAudioBufferFromInterleaved(new Float32Array([
        1, -1,
        0.5, -0.5,
        0.25, -0.25,
    ]), 2, 48000);

    assertEqual(buffer.sampleRate, 48000);
    assertEqual(buffer.length, 3);
    assertEqual(buffer.numberOfChannels, 2);
    assertArrayEqual(buffer.getChannelData(0), [1, 0.5, 0.25]);
    assertArrayEqual(buffer.getChannelData(1), [-1, -0.5, -0.25]);
    assertArrayEqual(audio.mixAudioBufferToMono(buffer), [0, 0, 0]);
});

Deno.test('리샘플러는 동일 입력에서 동일한 PCM과 checksum을 만든다', () => {
    const buffer = makeAudioBuffer([
        new Float32Array([0, 1, 0, -1, 0, 1]),
    ], 48000, 0.001);

    const first = audio.normalizeAudioBuffer(buffer, 16000);
    const second = audio.normalizeAudioBuffer(buffer, 16000);

    assertEqual(first.pcm.length, 16);
    assertArrayEqual(first.pcm, Array.from(second.pcm));
    assertEqual(first.checksum, second.checksum);
});
