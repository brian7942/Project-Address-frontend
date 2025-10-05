// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// 기본: Next 권장 규칙
const eslintConfig = [
  // Next + TS 규칙을 FlatCompat로 불러오기
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 공통 설정
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    rules: {
      // 미사용 인자 경고 완화: _로 시작하면 무시
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // 임시 완화: UI 데모/레이어 쪽에서만 any 허용 (추후 타입화하며 제거)
  {
    files: [
      "src/app/tools/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
