import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  initializeAppMock,
  getAppsMock,
  certMock,
  getAuthMock,
  getFirestoreMock,
  getStorageMock,
  fakeApp,
  fakeAuth,
  fakeDb,
  fakeStorage,
} = vi.hoisted(() => {
  const fakeApp = { name: 'fake-app' };
  const fakeAuth = { name: 'fake-auth' };
  const fakeDb = { name: 'fake-db' };
  const fakeStorage = { name: 'fake-storage' };

  const initializeAppMock = vi.fn(() => fakeApp);
  const getAppsMock = vi.fn(() => [] as (typeof fakeApp)[]);
  const certMock = vi.fn((creds: unknown) => ({ _kind: 'cert', creds }));
  const getAuthMock = vi.fn(() => fakeAuth);
  const getFirestoreMock = vi.fn(() => fakeDb);
  const getStorageMock = vi.fn(() => fakeStorage);

  return {
    initializeAppMock,
    getAppsMock,
    certMock,
    getAuthMock,
    getFirestoreMock,
    getStorageMock,
    fakeApp,
    fakeAuth,
    fakeDb,
    fakeStorage,
  };
});

vi.mock('firebase-admin/app', () => ({
  initializeApp: initializeAppMock,
  getApps: getAppsMock,
  cert: certMock,
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: getAuthMock,
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: getFirestoreMock,
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: getStorageMock,
}));

const ENV_KEYS = [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'GCLOUD_PROJECT',
  'FIREBASE_ADMIN_PROJECT_ID',
];

describe('firebase-admin singleton', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    initializeAppMock.mockClear();
    getAppsMock.mockClear();
    certMock.mockClear();
    getAuthMock.mockClear();
    getFirestoreMock.mockClear();
    getStorageMock.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it('reuses the cached app singleton across calls without reinitializing', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const first = getAdminApp();
    const second = getAdminApp();
    const third = getAdminApp();

    expect(first).toBe(fakeApp);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
  });

  it('initializes with projectId only (uses runtime SA via applicationDefault) when no emulators', async () => {
    process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'my-project';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(fakeApp);
    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'my-project' });
  });

  it('uses GCLOUD_PROJECT as fallback when FIREBASE_ADMIN_PROJECT_ID is absent', async () => {
    process.env['GCLOUD_PROJECT'] = 'demo-from-gcloud';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(fakeApp);
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'demo-from-gcloud' });
  });

  it('initializes lightweight with GCLOUD_PROJECT when FIRESTORE_EMULATOR_HOST is set', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    process.env['GCLOUD_PROJECT'] = 'demo-from-gcloud';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(fakeApp);
    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'demo-from-gcloud' });
  });

  it('falls back to FIREBASE_ADMIN_PROJECT_ID when GCLOUD_PROJECT is absent in emulator mode', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'demo-from-admin';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(fakeApp);
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'demo-from-admin' });
  });

  it('uses EMULATOR_PROJECT_ID_FALLBACK when no projectId envs are set in emulator mode', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(fakeApp);
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'admin-platform-dev' });
  });

  it('returns existing app from getApps() if available', async () => {
    const existing = { name: 'existing-app' };
    getAppsMock.mockReturnValue([existing]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(existing);
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it('getAdminAuth/getAdminDb/getAdminStorage return correctly typed services', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    getAppsMock.mockReturnValue([]);
    const { getAdminAuth, getAdminDb, getAdminStorage } = await import('./firebase-admin.js');

    expect(getAdminAuth()).toBe(fakeAuth);
    expect(getAdminDb()).toBe(fakeDb);
    expect(getAdminStorage()).toBe(fakeStorage);
    expect(getAuthMock).toHaveBeenCalledWith(fakeApp);
    expect(getFirestoreMock).toHaveBeenCalledWith(fakeApp);
    expect(getStorageMock).toHaveBeenCalledWith(fakeApp);
  });
});
