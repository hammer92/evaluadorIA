// =============================================================================
// Firebase Cloud Functions (v2) — entrypoint (SDD-06).
// =============================================================================
// Estructura:
//   v1/auth/       — endpoints de autenticación (sign-up público)
//   v1/users/      — endpoints de usuarios (admin)
//   v1/reports/    — endpoints de generación de reportes
//   v1/templates/  — endpoints de templates de exámenes (SDD-10)
//   shared/        — wrappers reutilizables (onCallAuth, validateInput, etc.)
//
// Naming convention: <v1DomainAction> (camelCase) — el nombre del export
// es el nombre de la función desplegada.
//
// Arquitectura estática (sin SSR): el frontend (Next.js) se deploya
// estaticamente a Firebase Hosting; el cliente llama a las CFs via
// httpsCallable() (callable CFs) o fetch() (HTTP CFs). Auth via Firebase
// Auth ID token incluido automáticamente por el SDK cliente.
// =============================================================================

// v1/auth
export { v1AuthSignUp } from './v1/auth/sign-up.js';

// v1/users
export { v1UsersCreate } from './v1/users/create-user.js';
export { v1UsersList } from './v1/users/list-users.js';
export { v1UsersUpdate } from './v1/users/update-user.js';
export { v1UsersDelete } from './v1/users/delete-user.js';

// v1/reports
export { v1ReportsGenerate } from './v1/reports/generate-report.js';

// v1/templates (SDD-10)
export { v1TemplatesCreate } from './v1/templates/create-template.js';
export { v1TemplatesGet } from './v1/templates/get-template.js';
export { v1TemplatesList } from './v1/templates/list-templates.js';
export { v1TemplatesUpdate } from './v1/templates/update-template.js';
export { v1TemplatesDelete } from './v1/templates/delete-template.js';
export { v1TemplatesTransition } from './v1/templates/transition-template.js';
export { v1TemplatesExpertEdit } from './v1/templates/expert-edit-template.js';
export { v1TemplatesGetReviewHistory } from './v1/templates/get-review-history.js';

// Utility (no se deploya como endpoint — uso interno desde otras CFs)
export { setUserRole } from './v1/users/set-role.js';
