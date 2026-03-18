// eslint.config.ts
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';

// Plugins (flat config can import plugins directly)
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import vitestPlugin from 'eslint-plugin-vitest';

// Utility: resolve tsconfig for parser
const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');

// Common file globs
const TS = ['**/*.ts', '**/*.tsx'];
const JS = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'];
const TESTS = ['**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}', '**/tests/**/*.{ts,tsx,js,jsx}'];
const CONFIG = ['*.config.*', 'scripts/**', 'tooling/**'];

// Ignores
const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.vite/**',
  '**/coverage/**',
  '**/*.min.*',
  '**/.eslintcache',
];

// Base: JS recommended
const base = js.configs.recommended;

// TypeScript recommended + stylistic
const tsConfigs = tseslint.configs.recommendedTypeChecked;

// React: rules + settings for version detection
const reactRules = {
  ...reactPlugin.configs.recommended.rules,
  // Enable modern JSX runtime
  'react/react-in-jsx-scope': 'off',
  // Prefer function components
  'react/prefer-stateless-function': 'off',
};
const reactSettings = {
  react: { version: 'detect' },
};

// React Hooks: recommended
const reactHooksRules = reactHooksPlugin.configs.recommended.rules;

// a11y: recommended
const jsxA11yRules = jsxA11yPlugin.configs.recommended.rules;

// Import plugin base
const importRules: Record<string, any> = {
  // Detect unresolved imports
  'import/no-unresolved': 'error',
  'import/named': 'error',
  'import/no-duplicates': 'error',
  // Order groups for readability
  'import/order': [
    'warn',
    {
      groups: [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling', 'index'],
        'object',
        'type',
      ],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
};

// Prettier: run as an ESLint rule and surface formatting issues inline
const prettierRules = {
  'prettier/prettier': [
    'warn',
    {
      // You can mirror your .prettierrc here if you like
      printWidth: 100,
      singleQuote: true,
      trailingComma: 'all',
      semi: true,
    },
  ],
};

// Export flat config
export default [
  // 0) Ignore
  { ignores },

  // 1) Base JS
  {
    files: [...JS, ...TS],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    // Add to help 'import' plugin resolve TS paths/aliases
    settings: {
      'import/resolver': {
        typescript: {
          // the tsconfig that contains "compilerOptions.paths"
          project: tsconfigPath,
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...base.rules,
      ...importRules,
      ...prettierRules,
      // General niceties
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
    },
  },

  // 2) TypeScript (+ type-aware rules)
  {
    files: TS,
    // Use the type-aware parser
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir: process.cwd(),
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...tsConfigs.reduce((acc, cfg) => ({ ...acc, ...cfg.rules }), {}),
      // Match your strict style (you’re using exactOptionalPropertyTypes)
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/require-await': 'off',
    },
  },

  // 3) React + Hooks + a11y (TSX/JSX files only)
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    settings: reactSettings,
    rules: {
      ...reactRules,
      ...reactHooksRules,
      ...jsxA11yRules,
    },
  },

  // 4) Test files: relax some rules, add jest/vitest env globs, and enable vitest plugin
  {
    files: TESTS,
    plugins: {
      vitest: vitestPlugin,
    },
    // Recognize vitest globals
    languageOptions: {
      globals: {
        // core
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        // lifecycle
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        // vitest mock/timer/util
        vi: 'readonly',
      },
    },
    // Use vitest:recommended rules, then tweak as desired
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      // Optional niceties:
      // 'vitest/no-disabled-tests': 'warn',
      // 'vitest/no-identical-title': 'error',
      // 'vitest/expect-expect': 'off', // turn off if using custom assertions
    },
  },

  // 5) Config / scripts: plain Node-ish environment
  {
    files: CONFIG,
    languageOptions: {
      globals: {
        // Minimal Node globals for config files
        module: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      // Config files often need console output
      'no-console': 'off',
    },
  },
];