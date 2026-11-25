import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve("package.json"));
// The managed preview passes Vite-style flags. Next uses --hostname.
const args = process.argv.slice(2)
  .filter(argument => argument !== "--strictPort")
  .map(argument => argument === "--host" ? "--hostname" : argument);
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...args], {
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", code => { process.exitCode = code ?? 0; });
