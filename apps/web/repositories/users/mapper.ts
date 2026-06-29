import type { User } from '@shared/schemas/users';
import type { Timestamp as FbTimestamp } from 'firebase/firestore';

// =============================================================================
// User mapper — snake_case (Firestore) ↔ camelCase (TypeScript).
// =============================================================================
// Convenciones:
//   - Firestore almacena en snake_case (ver data-model.md §1)
//   - El dominio (services, UI) consume camelCase
//   - El mapper es el ÚNICO punto donde ocurre la traducción
//   - `null` se preserva para campos opcionales (displayName, photoURL, etc.)
// =============================================================================

export interface UserRaw {
  email: string;
  display_name: string | null;
  photo_url: string | null;
  role: User['role'];
  organization_id: string | null;
  status: User['status'];
  last_login_at: FbTimestamp | null;
  created_at: FbTimestamp;
  updated_at: FbTimestamp;
  created_by: string;
  deleted_at: FbTimestamp | null;
}

export const toUser = (uid: string, raw: UserRaw): User => ({
  uid,
  email: raw.email,
  displayName: raw.display_name,
  photoURL: raw.photo_url,
  role: raw.role,
  organizationId: raw.organization_id,
  status: raw.status,
  lastLoginAt: raw.last_login_at?.toDate() ?? null,
  createdAt: raw.created_at.toDate(),
  updatedAt: raw.updated_at.toDate(),
  createdBy: raw.created_by,
  deletedAt: raw.deleted_at?.toDate() ?? null,
});

export const toUserInputRaw = (input: {
  email: string;
  displayName?: string;
  role: User['role'];
  organizationId?: string;
}): Pick<UserRaw, 'email' | 'display_name' | 'role' | 'organization_id' | 'status'> => ({
  email: input.email,
  display_name: input.displayName ?? null,
  role: input.role,
  organization_id: input.organizationId ?? null,
  status: 'invited',
});

export const toUpdateRaw = (
  input: Partial<{
    displayName: string | null;
    photoURL: string | null;
    role: User['role'];
    status: User['status'];
  }>,
): Partial<UserRaw> => {
  const raw: Partial<UserRaw> = {};
  if (input.displayName !== undefined) raw.display_name = input.displayName;
  if (input.photoURL !== undefined) raw.photo_url = input.photoURL;
  if (input.role !== undefined) raw.role = input.role;
  if (input.status !== undefined) raw.status = input.status;
  return raw;
};
