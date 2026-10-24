export const uploadLimits={files:500,fileBytes:256*1024,totalBytes:8*1024*1024,totalCharacters:2_000_000,requestBytes:24*1024*1024};
export const supportedSource=/\.(md|txt|js|jsx|mjs|cjs|ts|tsx|json|py|sql|css|html|yaml|yml)$/i;
const excluded=/(^|\/)(\.env[^/]*|\.git|node_modules|vendor|dist|build|coverage|\.next|\.turbo|\.cache|\.venv|venv|__pycache__|credentials[^/]*|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)(\/|$)/i;
export function exclusionReason(path:string):string|null {
  if(excluded.test(path))return 'Secrets, dependencies or generated files';
  if(!supportedSource.test(path))return 'Unsupported or binary file';
  return null;
}
