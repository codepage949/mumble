import { serveDir } from "jsr:@std/http@1/file-server";

const fsRoot = import.meta.dirname ?? ".";

const crossOriginHeaders = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
};

Deno.serve(async (request: Request) => {
    const response = await serveDir(request, {
        fsRoot,
        quiet: true,
    });

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(crossOriginHeaders)) {
        headers.set(key, value);
    }

    if (new URL(request.url).pathname === "/") {
        headers.set("Cache-Control", "no-store");
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
});
