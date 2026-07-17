import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  auth: {
    createUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    deleteUser: vi.fn(),
    verifyIdToken: vi.fn(),
  },
}));

vi.mock('../../../firebase-admin.js', () => ({
  getAdminAuth: vi.fn(() => hoisted.auth),
  getAdminDb: vi.fn(() => ({})),
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({})),
}));

const { setUserRole } = await import('../set-role.js');

describe('setUserRole', () => {
  beforeEach(() => {
    hoisted.auth.setCustomUserClaims.mockReset();
  });

  it('setea solo role cuando no se pasa organizationId', async () => {
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);
    await setUserRole('u1', 'admin');
    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { role: 'admin' });
  });

  it('incluye organizationId cuando se pasa string', async () => {
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);
    await setUserRole('u2', 'recruiter', 'org-7');
    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('u2', {
      role: 'recruiter',
      organizationId: 'org-7',
    });
  });

  it('acepta organizationId null', async () => {
    hoisted.auth.setCustomUserClaims.mockResolvedValueOnce(undefined);
    await setUserRole('u3', 'expert', null);
    expect(hoisted.auth.setCustomUserClaims).toHaveBeenCalledWith('u3', {
      role: 'expert',
      organizationId: null,
    });
  });

  it('propaga errores de setCustomUserClaims', async () => {
    hoisted.auth.setCustomUserClaims.mockRejectedValueOnce(new Error('boom'));
    await expect(setUserRole('u4', 'admin')).rejects.toThrow('boom');
  });
});
