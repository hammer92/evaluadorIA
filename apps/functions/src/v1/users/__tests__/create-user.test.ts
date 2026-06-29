import { describe, it, expect, vi } from 'vitest';

import { v1UsersCreate } from '../create-user.js';
import { v1UsersList } from '../list-users.js';

vi.mock('../../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(),
  getAdminDb: vi.fn(),
}));

describe('v1 endpoints (smoke)', () => {
  it('v1UsersCreate está registrado como Cloud Function v2', () => {
    expect(v1UsersCreate).toBeDefined();
    // onCall devuelve un objeto con la configuración interna de Firebase
    // (run, __endpoint, etc.). No exponemos la shape completa porque es
    // interna de firebase-functions; basta con verificar que está definido.
  });

  it('v1UsersList está registrado como Cloud Function v2', () => {
    expect(v1UsersList).toBeDefined();
  });
});
