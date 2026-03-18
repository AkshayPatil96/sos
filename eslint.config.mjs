// @ts-check
import eslintPlugin from '@typescript-eslint/eslint-plugin';
import eslintParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/generated/**', // ← this line — Prisma generated client
      'prisma/**',
      'coverage/**',
      '*.config.*',
      '.husky/**',
    ],
  },
  {
    files: ['src/**/*.ts'],
    plugins: {
      '@typescript-eslint': eslintPlugin,
    },
    languageOptions: {
      parser: eslintParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      ...eslintPlugin.configs['recommended'].rules,
      ...eslintPlugin.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 'no-console': 'warn',
    },
  },
  prettierConfig,
]);
