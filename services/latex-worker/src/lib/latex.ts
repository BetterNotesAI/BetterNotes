import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

export async function compileLatex(jobId: string, texSource: string, timeoutMs: number): Promise<Buffer> {
  const workingDirectory = await mkdtemp(join(tmpdir(), `bn-${jobId}-`));
  const texPath = join(workingDirectory, "main.tex");
  const pdfPath = join(workingDirectory, "main.pdf");

  try {
    await writeFile(texPath, texSource, "utf8");

    await new Promise<void>((resolve, reject) => {
      const child = spawn("tectonic", ["--outdir", workingDirectory, "--synctex", "0", "main.tex"], {
        cwd: workingDirectory,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
      });

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("LaTeX compilation timeout reached"));
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Tectonic failed with code ${code}. Output: ${output.slice(-3000)}`));
          return;
        }

        resolve();
      });
    });

    return await readFile(pdfPath);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
