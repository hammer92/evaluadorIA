// =============================================================================
// Repositories index — re-exports + factory helpers.
// =============================================================================
// Cada subdirectorio (`users/`, `organizations/`, `audit-logs/`) expone su
// propio factory (`getUserRepository()`, etc.) y su `__reset<Entity>Repository()`
// para tests. Ver ADR-0002.
// =============================================================================

export * from './users';
export * from './organizations';
export * from './audit-logs';
export { RepositoryError } from './errors';
