import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

const nonProjectFiles = [
  '**/*.test.{ts,tsx}',
  '**/__tests__/**/*.{ts,tsx}',
  '**/*.config.{ts,tsx,js,mjs,cjs}',
  '**/vitest.setup.ts',
  'scripts/**/*.{ts,mts}',
  // scripts/ fuera de src/ no estan en ningun tsconfig de proyecto
  // (los scripts se ejecutan con tsx, no tsc). Los exluimos del
  // projectService de typescript-eslint para evitar 'not found by
  // the project service'.
  'apps/functions/scripts/**/*.{ts,mts}',
];

const testOverrides = {
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/consistent-type-definitions': 'off',
  },
};

const disableTypeChecked = {
  ...tseslint.configs.disableTypeChecked,
  files: nonProjectFiles,
};

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', 'apps/functions/lib/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  disableTypeChecked,
  {
    ...testOverrides,
    files: nonProjectFiles,
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['firebase/firestore', 'firebase/auth', 'firebase/storage', 'firebase-admin/*'],
            message: 'No importes Firebase directamente desde esta capa. Usá el repository correspondiente.' },
          { group: ['@/repositories/*/firebase', '@/repositories/*/firebase.ts'],
            message: 'No importes la impl Firebase directamente. Usá el índice del repository.' },
        ],
      }],
    },
  },
  {
    // El wrapper oficial de Firebase es el único punto de imports directo al SDK.
    // Por eso se exime de la regla `no-restricted-imports` SOLO en este path.
    // Tests del wrapper también incluidos (jest los necesita accesibles).
    files: ['apps/web/lib/firebase/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Los repositories son la capa de aislamiento del vendor. Las imples Firebase
    // (`repositories/*/firebase.ts`) y sus mappers (`mapper.ts`, que solo usa
    // types de firebase/firestore para snake_case) necesitan acceso al SDK.
    // Tests de integración también acceden al SDK directamente.
    files: [
      'apps/web/repositories/**/firebase.ts',
      'apps/web/repositories/**/mapper.ts',
      'apps/web/repositories/**/__tests__/**',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['**/*.config.{ts,tsx,js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: { module: 'readonly' } },
  },
  prettier,
);