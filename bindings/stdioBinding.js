import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Normalize recorded interactive terminal output. Live stderr remains unchanged.
// Work on the complete transcript because escape sequences may cross data chunks.
function normalizeInteractiveStderr(value) {
  return value
    // OSC sequences (e.g. terminal window titles), terminated by BEL or ST.
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // CSI sequences, including readline cursor positioning and erase commands.
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    // Other short escape sequences.
    .replace(/\x1b[@-_]/g, "")
    // Normalize CRLF and standalone carriage returns.
    .replace(/\r\n?/g, "\n");
}

export async function executeStdioBinding(binding, inputs, baseDir = process.cwd()) {
  const interactive = binding.interactive === true;
  const args = binding.args || [];
  let tempDir;

  if (interactive && !process.stdin.isTTY) {
    return {
      command: binding.command,
      args,
      inputs,
      exitCode: null,
      stdout: "",
      stderr: "",
      error: "Interactive STDIO capability requires a terminal (TTY) on stdin"
    };
  }

  try {
    const env = { ...process.env };
    if (interactive) {
      tempDir = await mkdtemp(join(tmpdir(), "grail-stdio-"));
      const inputPath = join(tempDir, "inputs.json");
      await writeFile(inputPath, JSON.stringify(inputs), { mode: 0o600, flag: "wx" });
      env.GRAIL_INPUTS_FILE = inputPath;
    } else {
      // Prevent an inherited variable from changing the input contract.
      delete env.GRAIL_INPUTS_FILE;
    }

    return await new Promise((resolve, reject) => {
      const child = spawn(binding.command, args, {
        cwd: baseDir,
        env,
        stdio: [interactive ? "inherit" : "pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        if (interactive) process.stderr.write(data);
      });

      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      child.on("close", (exitCode) => {
        if (settled) return;
        settled = true;
        let parsedStdout = null;
        let parseError = null;

        if (stdout.trim()) {
          try {
            parsedStdout = JSON.parse(stdout);
          } catch (error) {
            parseError = `Invalid JSON on stdout: ${error.message}`;
          }
        } else {
          parseError = "No JSON returned on stdout";
        }

        const recordedStderr = interactive ? normalizeInteractiveStderr(stderr) : stderr;

        resolve({
          command: binding.command,
          args,
          inputs,
          exitCode,
          stdout: parsedStdout ?? stdout,
          stderr: recordedStderr,
          error:
            exitCode !== 0
              ? recordedStderr.trim() || `Process exited with code ${exitCode}`
              : parseError
        });
      });

      if (!interactive) {
        child.stdin.on("error", (error) => {
          // EPIPE is possible if a capability exits without reading inputs.
          if (error.code !== "EPIPE" && !settled) {
            settled = true;
            reject(error);
          }
        });
        child.stdin.end(JSON.stringify(inputs));
      }
    });
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}
