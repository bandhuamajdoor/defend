import { describe, it, expect, vi } from "vitest";
import { selectUploadCandidates } from "../src/domain/folder-selection";
import {
  exclusionReason,
  folderExclusionReason,
} from "../src/domain/upload-limits";
import { ingest } from "../src/services/ingestion";
import { sample } from "../src/fixtures/sample";

function candidate(path: string, text = "source text") {
  return {
    path,
    size: Buffer.byteLength(text),
    readText: vi.fn(async () => text),
  };
}
describe("C/C++ source folder regression", () => {
  it("keeps implementation, headers, templates, build files and configuration", () => {
    const paths = [
      "README.md",
      ".gitignore",
      "src/main.cpp",
      "src/db.cc",
      "src/utils.c",
      "include/kv/storage_engine.hpp",
      "include/kv/map.tpp",
      "include/utils.h",
      "include/detail.ipp",
      "Makefile",
      "src/Makefile",
      "CMakeLists.txt",
      "cmake/toolchain.cmake",
      "config/db.conf",
    ];
    const files = paths.map((path) => ({
      path,
      text: "// original project context",
    }));
    expect(ingest({ ...sample, files }).files.map((f) => f.path)).toEqual(
      paths,
    );
  });
  it("does not confuse text source with binary files or exclude all include/", () => {
    expect(exclusionReason("src/db.cpp")).toBeNull();
    expect(exclusionReason("bin/db.exe")).toBe("File type not supported");
    expect(folderExclusionReason("include/kv/storage_engine.hpp")).toBeNull();
    expect(folderExclusionReason("include/asio.hpp")).toContain(
      "Bundled library",
    );
    expect(folderExclusionReason("include/crow.h")).toContain(
      "Bundled library",
    );
    expect(exclusionReason("include/crow.h")).toBeNull();
  });
  it("filters hundreds of bundled headers before the 500-source-file limit or any source reads", async () => {
    const own = [
      "README.md",
      "src/db.cpp",
      "src/main.cpp",
      "src/Makefile",
      "include/kv/robin_hood_map.tpp",
      "include/kv/storage_engine.hpp",
      "config/db.conf",
    ].map((path) => candidate(path));
    const bundled = Array.from({ length: 622 }, (_, i) =>
      candidate(`include/asio/detail/header-${i}.hpp`),
    );
    const result = await selectUploadCandidates([...own, ...bundled], true);
    expect(result.eligible.map((f) => f.path)).toEqual(own.map((f) => f.path));
    expect(result.excluded).toHaveLength(622);
    for (const file of [...own, ...bundled])
      expect(file.readText).not.toHaveBeenCalled();
  });
});
describe("folder .gitignore rules", () => {
  const root = `# root rules\n/cache/\n*.o\n*.cpp\n!src/main.cpp\n*.generated.hpp\n.env*\n!.env.local\n`;
  const nested = `!keep.cpp\n/local.hpp\n!manual.generated.hpp\n`;
  it.each([
    ["src/main.cpp", false],
    ["src/other.cpp", true],
    ["src/keep.cpp", false],
    ["other/keep.cpp", true],
    ["cache/file.hpp", true],
    ["src/cache/file.hpp", false],
    ["src/local.hpp", true],
    ["src/deep/local.hpp", false],
    ["src/manual.generated.hpp", false],
    ["src/auto.generated.hpp", true],
    ["src/nested/recovered.generated.hpp", false],
    ["src/main.o", true],
  ])("applies scoped rules to %s (excluded=%s)", async (path, excluded) => {
    const result = await selectUploadCandidates(
      [
        candidate(".gitignore", root),
        candidate("src/.gitignore", nested),
        candidate("src/nested/.gitignore", "!recovered.generated.hpp"),
        candidate(path),
      ],
      true,
    );
    expect(result.excluded.some((f) => f.path === path)).toBe(excluded);
    if (excluded)
      expect(result.excluded.find((f) => f.path === path)?.reason).toContain(
        "Ignored by",
      );
    expect(result.gitignoreFiles).toBe(3);
  });
  it("does not read or re-include files under an ignored parent", async () => {
    const nested = candidate("generated/.gitignore", "!keep.hpp"),
      source = candidate("generated/keep.hpp");
    const result = await selectUploadCandidates(
      [candidate(".gitignore", "generated/"), nested, source],
      true,
    );
    expect(result.excluded).toContainEqual({
      path: source.path,
      reason: "Ignored by .gitignore",
    });
    expect(nested.readText).not.toHaveBeenCalled();
    expect(source.readText).not.toHaveBeenCalled();
    expect(result.gitignoreFiles).toBe(1);
  });
  it("allows children only when their parent directory is re-included", async () => {
    const result = await selectUploadCandidates(
      [
        candidate(
          ".gitignore",
          "generated/*\n!generated/kept/\ngenerated/kept/*\n!generated/kept/manual.hpp",
        ),
        candidate("generated/kept/manual.hpp"),
        candidate("generated/other.hpp"),
      ],
      true,
    );
    expect(result.eligible.map((f) => f.path)).toContain(
      "generated/kept/manual.hpp",
    );
    expect(result.excluded.map((f) => f.path)).toContain("generated/other.hpp");
  });
  it("handles escaped names and CRLF without treating comments as patterns", async () => {
    const result = await selectUploadCandidates(
      [
        candidate(
          ".gitignore",
          "# note\r\n\\#literal.hpp\r\n\\!literal.hpp\r\nspace\\ name.hpp\r\n",
        ),
        ...["#literal.hpp", "!literal.hpp", "space name.hpp", "note.hpp"].map(
          (path) => candidate(path),
        ),
      ],
      true,
    );
    expect(result.excluded.map((f) => f.path)).toEqual([
      "#literal.hpp",
      "!literal.hpp",
      "space name.hpp",
    ]);
    expect(result.eligible.map((f) => f.path)).toContain("note.hpp");
  });
  it("cannot use ignore negation to bypass secret or generated-directory safeguards", async () => {
    const result = await selectUploadCandidates(
      [
        candidate(
          ".gitignore",
          "!.env.local\n!node_modules/\n!node_modules/app.ts",
        ),
        candidate(".env.local"),
        candidate("node_modules/app.ts"),
      ],
      true,
    );
    expect(result.excluded).toHaveLength(2);
    expect(result.excluded.every((f) => f.reason.includes("Secrets"))).toBe(
      true,
    );
  });
  it("reads .gitignore rules even when the ignore file itself is ignored", async () => {
    const result = await selectUploadCandidates(
      [
        candidate(".gitignore", "**/.gitignore"),
        candidate("src/.gitignore", "skip.hpp"),
        candidate("src/skip.hpp"),
      ],
      true,
    );
    expect(result.gitignoreFiles).toBe(2);
    expect(result.excluded.find((f) => f.path === "src/skip.hpp")?.reason).toBe(
      "Ignored by src/.gitignore",
    );
  });
  it("fails visibly instead of ignoring oversized or unreadable ignore rules", async () => {
    await expect(
      selectUploadCandidates(
        [candidate(".gitignore", "x".repeat(65537))],
        true,
      ),
    ).rejects.toThrow(/rules were not skipped/);
    const invalid = candidate(".gitignore");
    invalid.readText.mockRejectedValue(new Error("invalid UTF-8"));
    await expect(selectUploadCandidates([invalid], true)).rejects.toThrow(
      /Cannot read .gitignore/,
    );
  });
  it("does not apply folder defaults to intentionally selected library files", async () => {
    const result = await selectUploadCandidates(
      [candidate("include/crow.h")],
      false,
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.gitignoreFiles).toBe(0);
  });
});
