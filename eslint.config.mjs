import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/lib/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
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
    files: ['**/*.cjs'],
    languageOptions: { globals: { module: 'readonly' } },
  },
  prettier,
);