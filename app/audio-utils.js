(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.WhisperWasmAudio = factory();
    }
})(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    function getDurationSeconds(audioBuffer) {
        if (audioBuffer && Number.isFinite(audioBuffer.duration) && audioBuffer.duration > 0) {
            return audioBuffer.duration;
        }

        if (audioBuffer && Number.isFinite(audioBuffer.length) && Number.isFinite(audioBuffer.sampleRate) && audioBuffer.sampleRate > 0) {
            return audioBuffer.length/audioBuffer.sampleRate;
        }

        return 0;
    }

    function getTargetSampleCount(audioBuffer, targetSampleRate) {
        const durationSeconds = getDurationSeconds(audioBuffer);
        const durationMs = Math.max(0, Math.round(durationSeconds*1000));
        return Math.round(durationMs*targetSampleRate/1000);
    }

    function mixAudioBufferToMono(audioBuffer) {
        const length = audioBuffer.length || 0;
        const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
        const mono = new Float32Array(length);

        for (let ch = 0; ch < channels; ch++) {
            const data = audioBuffer.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                mono[i] += data[i]/channels;
            }
        }

        return mono;
    }

    function makeAudioBufferFromInterleaved(pcm, numberOfChannels, sampleRate) {
        const channels = Math.max(1, numberOfChannels || 1);
        const length = Math.floor((pcm ? pcm.length : 0)/channels);
        const channelData = [];

        for (let ch = 0; ch < channels; ch++) {
            channelData.push(new Float32Array(length));
        }

        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < channels; ch++) {
                channelData[ch][i] = pcm[i*channels + ch];
            }
        }

        return {
            duration: sampleRate > 0 ? length/sampleRate : 0,
            length: length,
            numberOfChannels: channels,
            sampleRate: sampleRate,
            getChannelData: function(index) {
                return channelData[index];
            },
        };
    }

    function resampleLinear(input, inputSampleRate, targetSampleRate, targetLength) {
        const output = new Float32Array(Math.max(0, targetLength || 0));
        if (!input.length || !output.length || inputSampleRate <= 0 || targetSampleRate <= 0) {
            return output;
        }

        if (input.length === 1) {
            output.fill(input[0]);
            return output;
        }

        const ratio = inputSampleRate/targetSampleRate;
        const last = input.length - 1;

        for (let i = 0; i < output.length; i++) {
            const sourceIndex = Math.min(i*ratio, last);
            const left = Math.floor(sourceIndex);
            const right = Math.min(left + 1, last);
            const weight = sourceIndex - left;
            output[i] = input[left] + (input[right] - input[left])*weight;
        }

        return output;
    }

    function checksumFloat32(input) {
        const view = new DataView(new ArrayBuffer(4));
        let hash = 0x811c9dc5;

        for (let i = 0; i < input.length; i++) {
            view.setFloat32(0, input[i], true);
            for (let j = 0; j < 4; j++) {
                hash ^= view.getUint8(j);
                hash = Math.imul(hash, 0x01000193);
            }
        }

        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function normalizeAudioBuffer(audioBuffer, targetSampleRate) {
        const targetLength = getTargetSampleCount(audioBuffer, targetSampleRate);
        const mono = mixAudioBufferToMono(audioBuffer);
        const pcm = resampleLinear(mono, audioBuffer.sampleRate, targetSampleRate, targetLength);

        return {
            pcm: pcm,
            checksum: checksumFloat32(pcm),
            sourceSampleRate: audioBuffer.sampleRate,
            sourceLength: audioBuffer.length,
            targetSampleRate: targetSampleRate,
            targetLength: targetLength,
        };
    }

    return {
        checksumFloat32: checksumFloat32,
        getTargetSampleCount: getTargetSampleCount,
        makeAudioBufferFromInterleaved: makeAudioBufferFromInterleaved,
        mixAudioBufferToMono: mixAudioBufferToMono,
        normalizeAudioBuffer: normalizeAudioBuffer,
        resampleLinear: resampleLinear,
    };
});
