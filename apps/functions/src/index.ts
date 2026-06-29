/**
 * Firebase Cloud Functions (v2) — entrypoint.
 *
 * Real Cloud Functions (onCall, onRequest, triggers) are implemented in
 * SDD-06 per `aidlc-docs/inception/plans/execution-plan-sdd03.md`.
 *
 * This placeholder exists so that:
 *   - `pnpm --filter @platform/functions build` produces a valid `lib/index.js`
 *   - `firebase deploy --only functions` has something to deploy (no-op)
 *   - The repo structure for SDD-06 is already in place.
 */

export const noop = (): void => {
  // placeholder until SDD-06
};
