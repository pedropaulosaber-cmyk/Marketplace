import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'coverage/**',
      'prisma/migrations/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends('next/core-web-vitals'),

  {
    // Rules that need no type information apply everywhere.
    rules: {
      // Business rules must never silently lose their types.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Empty catch blocks hide failures — always handle or rethrow.
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Typed linting is restricted to the TypeScript sources it can actually
    // resolve. Applying it to config files (.mjs, outside tsconfig) is what
    // makes `consistent-type-imports` fail to load.
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'prisma/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  {
    // Scripts, seeds and test harnesses run outside the request path, and
    // console output is their actual interface.
    files: [
      'prisma/**/*.ts',
      'tests/**/*.ts',
      'tests/**/*.mjs',
      '**/*.config.*',
    ],
    rules: { 'no-console': 'off' },
  },

  prettier
);
