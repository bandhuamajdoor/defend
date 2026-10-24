import ts from "typescript";
import path from "node:path";
import type { Evidence } from "../domain/types";
export interface FileCard {
  path: string;
  lines: number;
  symbols: string[];
  imports: string[];
  resolvedImports: string[];
  precision: "syntax" | "line_windows";
}
export function buildProjectMap(evidence: Evidence[]): FileCard[] {
  const groups = new Map<string, Evidence[]>();
  for (const e of evidence) {
    const group = groups.get(e.path) ?? [];
    group.push(e);
    groups.set(e.path, group);
  }
  const cards = [...groups].map(([file, spans]) => {
    spans.sort((a, b) => a.startLine - b.startLine);
    const text = spans.map((e) => e.excerpt).join("\n");
    const symbols: string[] = [],
      imports: string[] = [];
    let precision: FileCard["precision"] = "line_windows";
    if (/\.[cm]?[jt]sx?$/.test(file)) {
      const tree = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      // Parse syntax only. Uploaded code is never imported or executed.
      const diagnostics = (tree as unknown as { parseDiagnostics: unknown[] })
        .parseDiagnostics;
      if (!diagnostics.length) precision = "syntax";
      function visit(node: ts.Node) {
        if (
          (ts.isFunctionDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node)) &&
          node.name
        )
          symbols.push(node.name.text);
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
          symbols.push(node.name.text);
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          imports.push(node.moduleSpecifier.text);
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
    return {
      path: file,
      lines: spans.at(-1)?.endLine ?? 1,
      symbols: [...new Set(symbols)].slice(0, 80),
      imports: [...new Set(imports)].slice(0, 60),
      resolvedImports: [] as string[],
      precision,
    };
  });
  const paths = new Set(cards.map((c) => c.path));
  for (const c of cards)
    for (const specifier of c.imports.filter((i) => i.startsWith("."))) {
      const base = path.posix.normalize(
        path.posix.join(path.posix.dirname(c.path), specifier),
      );
      const candidates = [
        base,
        base.replace(/\.js$/, ".ts"),
        ...[
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          "/index.ts",
          "/index.tsx",
          "/index.js",
        ].map((ext) => base + ext),
      ];
      const found = candidates.find((p) => paths.has(p));
      if (found) c.resolvedImports.push(found);
    }
  return cards;
}
function terms(text: string) {
  return [
    ...new Set(
      text
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter(
          (t) =>
            t.length > 2 &&
            ![
              "the",
              "and",
              "that",
              "this",
              "what",
              "with",
              "from",
              "your",
              "does",
              "have",
              "would",
              "could",
              "project",
              "explain",
            ].includes(t),
        ),
    ),
  ];
}
export function retrieve(
  evidence: Evidence[],
  map: FileCard[],
  query: string,
  pinned: string[] = [],
  maxChars = 11000,
  maxExcerpts = 6,
): {
  evidence: Evidence[];
  indexedFiles: number;
  indexedExcerpts: number;
  notes: string[];
} {
  const words = terms(query),
    cards = new Map(map.map((c) => [c.path, c]));
  const scored = evidence
    .map((e, index) => {
      const card = cards.get(e.path)!;
      const file = (e.path + " " + card.symbols.join(" ")).toLowerCase();
      const content = e.excerpt.toLowerCase();
      const score =
        words.reduce(
          (n, t) =>
            n + (file.includes(t) ? 6 : 0) + (content.includes(t) ? 2 : 0),
          0,
        ) +
        (pinned.includes(e.id) ? 10 : 0) +
        (e.startLine === 1 ? 1 : 0);
      return { e, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: Evidence[] = [];
  let size = 0;
  const paths = new Set<string>();
  function add(e: Evidence) {
    if (
      selected.some((x) => x.id === e.id) ||
      selected.length >= maxExcerpts ||
      size + e.excerpt.length > maxChars
    )
      return;
    selected.push(e);
    size += e.excerpt.length;
    paths.add(e.path);
  }
  // Diversify before filling additional windows of the same file.
  for (const { e } of scored) if (!paths.has(e.path)&&selected.length<3) add(e);
  const neighbors = new Set(
    [...paths].flatMap((p) => cards.get(p)?.resolvedImports ?? []),
  );
  for (const e of evidence) if (neighbors.has(e.path)) add(e);
  for (const { e } of scored) add(e);
  return {
    evidence: selected,
    indexedFiles: map.length,
    indexedExcerpts: evidence.length,
    notes: [
      `${map.length} files indexed; this request sees ${selected.length} complete source excerpts.`,
      `Files outside this evidence pack remain unverified. Symbol/import relationships do not prove runtime behaviour.`,
    ],
  };
}
export function compactMap(map: FileCard[], maxFiles = 40) {
  return {
    files: map
      .slice(0, maxFiles)
      .map((c) => ({
        path: c.path,
        lines: c.lines,
        symbols: c.symbols.slice(0, 12),
        imports: c.resolvedImports.slice(0, 8),
        precision: c.precision,
      })),
    omittedFromOverview: Math.max(0, map.length - maxFiles),
  };
}
