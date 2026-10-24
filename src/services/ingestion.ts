import { createHash, randomUUID } from "node:crypto";
import type { Upload } from "../domain/types";
import { requireThat } from "../domain/errors";
import { uploadLimits, exclusionReason } from "../domain/upload-limits";
export const sha = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function ingest(input: Upload) {
  requireThat(
    input.files.length > 0 && input.files.length <= uploadLimits.files,
    "LIMIT_EXCEEDED",
    "Choose between 1 and 500 source files.",
    413,
  );
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
      !exclusionReason(path),
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
      text.isWellFormed() && !text.includes("\0") && !text.includes("\ufffd"),
      "UNSUPPORTED_FILE",
      `Unsupported text encoding: ${path}. Use UTF-8 text.`,
    );
    const byteSize = Buffer.byteLength(text, "utf8");
    bytes += byteSize;
    chars += text.length;
    requireThat(
      byteSize <= uploadLimits.fileBytes,
      "LIMIT_EXCEEDED",
      `${path} exceeds 256 KiB.`,
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
    bytes <= uploadLimits.totalBytes && chars <= uploadLimits.totalCharacters,
    "LIMIT_EXCEEDED",
    "Project exceeds 8 MiB or 2,000,000 characters. Choose the feature you want to practise.",
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
  for (let i = 0; i < lines.length; ) {
    let end = i + 1,
      size = lines[i].length;
    while (
      end < lines.length &&
      end - i < 60 &&
      size + lines[end].length + 1 <= 10000
    ) {
      size += lines[end].length + 1;
      end++;
    }
    const excerpt = lines.slice(i, end).join("\n");
    windows.push({
      id: randomUUID(),
      fileId: file.id,
      startLine: i + 1,
      endLine: end,
      excerpt,
      sha256: sha(excerpt),
    });
    i = end;
  }
  return windows;
}
