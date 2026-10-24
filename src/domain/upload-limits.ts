export const uploadLimits = {
  files: 500,
  fileBytes: 256 * 1024,
  totalBytes: 8 * 1024 * 1024,
  totalCharacters: 2_000_000,
  requestBytes: 24 * 1024 * 1024,
};
export const supportedSource =
  /(?:\.(?:md|txt|js|jsx|mjs|cjs|ts|tsx|json|py|sql|css|html|yaml|yml|c|cc|cpp|cxx|h|hh|hpp|hxx|tpp|ipp|inl|mk|cmake|conf|ini|toml)$|(?:^|\/)(?:Makefile|GNUmakefile|CMakeLists\.txt|Dockerfile|\.gitignore|\.dockerignore|\.editorconfig)$)/i;
export const implementationSource =
  /\.(?:js|jsx|mjs|cjs|ts|tsx|py|sql|css|html|c|cc|cpp|cxx|h|hh|hpp|hxx|tpp|ipp|inl)$/i;
const excluded =
  /(^|\/)(\.env[^/]*|\.git|node_modules|vendor|dist|build|output|test-results|playwright-report|\.data|coverage|\.next|\.turbo|\.cache|\.venv|venv|__pycache__|credentials[^/]*|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)(\/|$)/i;
export function exclusionReason(path: string): string | null {
  if (excluded.test(path)) return "Secrets, dependencies or generated files";
  if (!supportedSource.test(path)) return "File type not supported";
  return null;
}
// Folder defaults only: a user may explicitly choose a library file for discussion.
// Never exclude all of include/: C/C++ project headers commonly live there.
export function folderExclusionReason(path: string): string | null {
  if (
    /(^|\/)(third_party|third-party|thirdparty)(\/|$)/i.test(path) ||
    /(^|\/)include\/(asio|crow)(\/|\.(h|hpp)$)/i.test(path)
  )
    return "Bundled library — choose individual files to include it";
  return exclusionReason(path);
}
