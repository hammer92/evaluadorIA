// =============================================================================
// Vitest setup (root) — jest-dom matchers
// =============================================================================
// Solo aplica a tests que usan `// @vitest-environment jsdom` (pragma en el
// archivo) o configuran jsdom en su workspace. Para tests con environment
// node (e.g., functions, shared) jest-dom no agrega nada porque no hay DOM.
// =============================================================================

import '@testing-library/jest-dom';
