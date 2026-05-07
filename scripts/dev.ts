let server: Deno.ChildProcess | null = null;
let serverStatus: Promise<Deno.CommandStatus> | null = null;
let rebuilding = false;
let queued = false;
let shuttingDown = false;

async function runBuild(): Promise<boolean> {
  const build = new Deno.Command("./scripts/build-whisper-wasm-static.sh", {
    stdout: "inherit",
    stderr: "inherit",
  });

  const status = await build.spawn().status;
  return status.success;
}

function startServer() {
  server = new Deno.Command("deno", {
    args: ["run", "--allow-net", "--allow-read", "server.ts"],
    cwd: "build-em/bin/whisper.wasm",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  serverStatus = server.status;
}

async function stopServer() {
  const current = server;
  const currentStatus = serverStatus;
  server = null;
  serverStatus = null;

  if (!current) {
    return;
  }

  try {
    current.kill("SIGTERM");
  } catch (_error) {
  }

  if (currentStatus) {
    await currentStatus.catch(function() {});
  }
}

async function rebuildAndRestart() {
  if (rebuilding) {
    queued = true;
    return;
  }

  rebuilding = true;
  do {
    queued = false;
    await stopServer();
    const ok = await runBuild();
    if (ok && !shuttingDown) {
      startServer();
    }
  } while (queued && !shuttingDown);
  rebuilding = false;
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await stopServer();
  Deno.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  Deno.addSignalListener(signal, function() {
    shutdown();
  });
}

await rebuildAndRestart();

let timer: number | undefined;
const watcher = Deno.watchFs("app");
console.log("Watching app/ for changes. Serving http://localhost:8000/");

for await (const event of watcher) {
  if (shuttingDown) {
    break;
  }

  if (event.kind === "access") {
    continue;
  }

  clearTimeout(timer);
  timer = setTimeout(function() {
    console.log("app/ changed. Rebuilding...");
    rebuildAndRestart();
  }, 150);
}
