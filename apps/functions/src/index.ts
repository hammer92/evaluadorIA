// =============================================================================
// Firebase Cloud Functions (v2) — entrypoint (SDD-06).
// =============================================================================
// Estructura:
//   v1/auth/    — endpoints de autenticación (sign-up público, session cookie)
//   v1/users/   — endpoints de usuarios (admin)
//   v1/reports/ — endpoints de generación de reportes
//   shared/     — wrappers reutilizables (onCallAuth, validateInput, etc.)
//
// Naming convention: <v1DomainAction> (camelCase) — el nombre del export
// es el nombre de la función desplegada.
// =============================================================================

// v1/auth
export { v1AuthSignUp } from './v1/auth/sign-up.js';
export { v1AuthCreateSession } from './v1/auth/create-session.js';
export { v1AuthClearSession } from './v1/auth/clear-session.js';

// v1/users
export { v1UsersCreate } from './v1/users/create-user.js';
export { v1UsersList } from './v1/users/list-users.js';
export { v1UsersUpdate } from './v1/users/update-user.js';
export { v1UsersDelete } from './v1/users/delete-user.js';

// v1/reports
export { v1ReportsGenerate } from './v1/reports/generate-report.js';

// Utility (no se deploya como endpoint — uso interno desde otras CFs)
export { setUserRole } from './v1/users/set-role.js';
