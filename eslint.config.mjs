import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores([
    // Prisma emits its client here (see the generator block in schema.prisma).
    'generated/**',
    // esbuild output from `npm run widget:build`.
    'public/widget/**',
    '.next/**',
    'dist/**',
    'coverage/**',
  ]),

  next,
  nextTypescript,

  {
    name: 'playstake/conventions',
    rules: {
      // `_`-prefixed bindings are deliberate throwaways across the codebase —
      // unused route-handler args (`_request`, `_context`) most of all.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // Worth seeing, not worth blocking a build over: the remaining `any`s sit
      // in Stripe webhook payloads, the error helpers, and the widget, and
      // typing them properly is a refactor rather than a lint fix.
      '@typescript-eslint/no-explicit-any': 'warn',

      // React Compiler-era rules from eslint-plugin-react-hooks v6. They flag
      // patterns used throughout the dashboard (fetch-then-setState inside an
      // effect, mutable refs in event handlers) that are correct as written.
      // Kept visible so new code trends the right way; revisit if the React
      // Compiler is ever turned on.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },

  {
    name: 'playstake/tests',
    files: ['tests/**/*.ts'],
    rules: {
      // Test helpers deliberately hand back loosely typed route responses.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    name: 'playstake/scripts',
    files: ['*.ts', '*.mjs', 'prisma/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      // Build scripts, seeds and workers log to the console by design.
      'no-console': 'off',
    },
  },
]);
