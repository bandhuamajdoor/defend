import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  // This app uses conventional effects to synchronize server snapshots and browser APIs.
  // React Compiler is not enabled; its optional ref/effect restrictions do not apply.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "dist/**",
    "output/**",
    "src/generated/**",
    "next-env.d.ts",
    "output-eslint.json",
  ]),
]);
