import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".learnbuddy/**", ".pnpm-store/**", "output/**", ".playwright-cli/**"]),
  {
    files: ["src/components/**/*.{ts,tsx}", "src/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/server", "@/server/**"], message: "共享组件和契约不能依赖服务端代码；请通过 props 或 API 传递数据。" }],
      }],
    },
  },
]);
