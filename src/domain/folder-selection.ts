import ignore, { type Ignore } from "ignore";
import {
  exclusionReason,
  folderExclusionReason,
  uploadLimits,
} from "./upload-limits";

export interface UploadCandidate {
  path: string;
  size: number;
  readText: () => Promise<string>;
}
export interface ExcludedFile {
  path: string;
  reason: string;
}

class FolderIgnore {
  private scopes = new Map<string, { file: string; matcher: Ignore }>();
  add(file: string, text: string) {
    const directory = file.includes("/")
      ? file.slice(0, file.lastIndexOf("/"))
      : "";
    this.scopes.set(directory, {
      file,
      matcher: ignore({ ignorecase: false }).add(text),
    });
  }
  reason(path: string): string | null {
    const directory = path.endsWith("/"),
      parts = path.replace(/\/$/, "").split("/");
    const active: { directory: string; file: string; matcher: Ignore }[] = [];
    const root = this.scopes.get("");
    if (root) active.push({ directory: "", ...root });
    for (let i = 1; i <= parts.length; i++) {
      const current = parts.slice(0, i).join("/");
      const isDirectory = i < parts.length || directory;
      let ignoredBy: string | null = null;
      for (const scope of active) {
        const relative =
          current.slice(scope.directory ? scope.directory.length + 1 : 0) +
          (isDirectory ? "/" : "");
        const result = scope.matcher.test(relative);
        if (result.ignored) ignoredBy = `Ignored by ${scope.file}`;
        else if (result.unignored) ignoredBy = null;
      }
      // An ignore file inside an excluded directory cannot re-include its children.
      if (ignoredBy) return ignoredBy;
      if (isDirectory) {
        const nested = this.scopes.get(current);
        if (nested) active.push({ directory: current, ...nested });
      }
    }
    return null;
  }
}

function validPath(path: string) {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !/^[a-z]:/i.test(path) &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    path.split("/").every((p) => p && p !== "." && p !== "..")
  );
}

// Only ignore files are read here. Rejected source/dependency contents never need
// to enter memory or leave the browser. Server upload/secret checks remain final.
export async function selectUploadCandidates<T extends UploadCandidate>(
  candidates: T[],
  folder: boolean,
) {
  const rules = new FolderIgnore();
  let gitignoreFiles = 0,
    ignoreBytes = 0;
  if (folder) {
    const ignores = candidates
      .filter((c) => validPath(c.path) && /(^|\/)\.gitignore$/.test(c.path))
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
    for (const file of ignores) {
      const parent = file.path.includes("/")
        ? file.path.slice(0, file.path.lastIndexOf("/"))
        : "";
      if (
        folderExclusionReason(file.path) ||
        (parent && rules.reason(parent + "/"))
      )
        continue;
      ignoreBytes += file.size;
      if (
        gitignoreFiles >= 100 ||
        file.size > 64 * 1024 ||
        ignoreBytes > 256 * 1024
      )
        throw new Error(
          "Too many or oversized .gitignore rules. Select a smaller project folder; ignore rules were not skipped.",
        );
      let text: string;
      try {
        text = await file.readText();
      } catch {
        throw new Error(
          `Cannot read ${file.path} as UTF-8. Fix it or select a smaller folder; ignore rules were not skipped.`,
        );
      }
      if (text.includes("\0") || !text.isWellFormed())
        throw new Error(
          `Invalid text in ${file.path}. Ignore rules were not skipped.`,
        );
      rules.add(file.path, text);
      gitignoreFiles++;
    }
  }
  const eligible: T[] = [],
    excluded: ExcludedFile[] = [];
  for (const file of candidates) {
    const reason = !validPath(file.path)
      ? "Invalid relative path"
      : ((folder
          ? (rules.reason(file.path) ?? folderExclusionReason(file.path))
          : exclusionReason(file.path)) ??
        (file.size > uploadLimits.fileBytes ? "Exceeds 256 KiB" : null));
    if (reason) excluded.push({ path: file.path, reason });
    else eligible.push(file);
  }
  return { eligible, excluded, gitignoreFiles };
}
