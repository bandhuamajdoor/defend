import { createHash, randomUUID } from "node:crypto";
import type { Upload } from "../domain/types";
import { requireThat } from "../domain/errors";
export const sha = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const allowed = /\.(md|txt|js|jsx|ts|tsx|json|py|sql|css|html|yaml|yml)$/i;
const blocked =
  /(^|\/)(\.env[^/]*|\.git|node_modules|vendor|dist|build|coverage|credentials[^/]*|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)(\/|$)/i;
export function ingest(input: Upload) {
  const names = new Set<string>();
  let bytes = 0,
    chars = 0;
  const files = input.files.map((f) => {
    const path = f.path.replaceAll("\\", "/").normalize("NFC");
    requireThat(
      !path.startsWith("/") &&
        !/^[a-z]:/i.test(path) &&
        !/[\x00-\x1f\x7f]/.test(path) &&
        !path.split("/").some((x) => !x || x === "." || x === ".."),
      "UNSUPPORTED_FILE",
      "Use clean relative file paths.",
    );
    requireThat(
      allowed.test(path) && !blocked.test(path),
      "UNSUPPORTED_FILE",
      `Excluded file: ${path}. Choose supported source files without secrets.`,
    );
    requireThat(
      !names.has(path.toLowerCase()),
      "UNSUPPORTED_FILE",
      `Duplicate file path: ${path}.`,
    );
    names.add(path.toLowerCase());
    const text = f.text.replace(/\r\n?/g, "\n");
    requireThat(
      !text.includes("\0") && !text.includes("\ufffd"),
      "UNSUPPORTED_FILE",
      `Unsupported text encoding: ${path}. Use UTF-8 text.`,
    );
    const byteSize = Buffer.byteLength(text, "utf8");
    bytes += byteSize;
    chars += text.length;
    requireThat(
      byteSize <= 65536,
      "LIMIT_EXCEEDED",
      `${path} exceeds 64 KiB.`,
      413,
    );
    const lines = text.split("\n");
    lines.forEach((line, i) =>
      requireThat(
        !/-----BEGIN .*PRIVATE KEY-----|\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b|(?:api[_-]?key|password|secret|access[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i.test(
          line,
        ),
        "POTENTIAL_SECRET",
        `Possible credential in ${path}, line ${i + 1}. Remove it before uploading.`,
      ),
    );
    return {
      id: randomUUID(),
      path,
      text,
      sha256: sha(text),
      byteSize,
      lineCount: lines.length,
    };
  });
  requireThat(
    bytes <= 524288 && chars <= 120000,
    "LIMIT_EXCEEDED",
    "Project exceeds 512 KiB or 120,000 characters.",
    413,
  );
  return {
    files,
    contentHash: sha(JSON.stringify(files.map((f) => [f.path, f.sha256]))),
  };
}
export function evidenceWindows(file: { id: string; text: string }) {
  const lines = file.text.split("\n");
  const windows = [];
  for (let i = 0; i < lines.length; i += 60) {
    const excerpt = lines.slice(i, i + 60).join("\n");
    windows.push({
      id: randomUUID(),
      fileId: file.id,
      startLine: i + 1,
      endLine: Math.min(i + 60, lines.length),
      excerpt,
      sha256: sha(excerpt),
    });
  }
  return windows;
}
