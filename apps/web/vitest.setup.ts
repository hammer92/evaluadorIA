// =============================================================================
// Vitest setup — jest-dom matchers.
// =============================================================================
// env vars se setean en el primer access via la validación lazy de env.ts.
// Antes de que cualquier test acceda a `clientEnv`/`env`, este setup corre
// (vitest ejecuta setupFiles antes de los tests, no antes de los imports).
// Como alternativa, los tests que importan repos pueden setear process.env
// en su módulo de test antes de importar el repo.
// =============================================================================

import '@testing-library/jest-dom';
