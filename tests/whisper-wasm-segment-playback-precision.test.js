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
    name: '세그먼트 재생 시간은 centisecond를 소수 초로 전달한다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await Deno.readTextFile('app/index-tmpl.html');

        assertIncludes(html, 'function segmentTimeSeconds(t)');
        assertIncludes(html, 'return Math.max(0, Number(t)*0.01);');
        assertIncludes(html, 'stopAt = segmentTimeSeconds(segment.t1);');
        assertIncludes(html, 'audioEl.currentTime = Math.max(0, segmentTimeSeconds(segment.t0) - kSegmentPlaybackLeadSeconds);');
        assertNotIncludes(html, 'audioEl.currentTime = Number(segment.t0)*0.01;');
    },
});

Deno.test({
    name: '세그먼트 시간 표시는 소수점 두 자리까지 보여준다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await Deno.readTextFile('app/index-tmpl.html');

        assertIncludes(html, 'const seconds = segmentTimeSeconds(t);');
        assertIncludes(html, 'toFixed(2).padStart(5,');
        assertNotIncludes(html, 'Math.round(t*0.01)');
    },
});

Deno.test({
    name: 'VAD 로그는 speech 구간을 출력한다',
    permissions: { read: ['app/index-tmpl.html'] },
    fn: async () => {
        const html = await Deno.readTextFile('app/index-tmpl.html');

        assertIncludes(html, 'function logVadSegments(logs)');
        assertIncludes(html, 'js: VAD only: segment #');
        assertIncludes(html, 'formatSeconds(log.start)');
        assertIncludes(html, 'formatSeconds(log.end)');
    },
});
