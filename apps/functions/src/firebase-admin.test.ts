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
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
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

  it('reuses an existing app returned by getApps() and skips initializeApp', async () => {
    const existing = { name: 'existing-app' };
    getAppsMock.mockReturnValue([existing]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();
    const again = getAdminApp();

    expect(app).toBe(existing);
    expect(again).toBe(existing);
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(certMock).not.toHaveBeenCalled();
  });

  it('initializes with explicit credentials when no emulators are detected', async () => {
    process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'my-project';
    process.env['FIREBASE_ADMIN_CLIENT_EMAIL'] = 'svc@my-project.iam.gserviceaccount.com';
    process.env['FIREBASE_ADMIN_PRIVATE_KEY'] =
      '-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n';

    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(app).toBe(fakeApp);
    expect(certMock).toHaveBeenCalledTimes(1);
    expect(certMock).toHaveBeenCalledWith({
      projectId: 'my-project',
      clientEmail: 'svc@my-project.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n',
    });
    expect(initializeAppMock).toHaveBeenCalledWith({
      credential: expect.objectContaining({ _kind: 'cert' }),
    });
  });

  it('throws when FIREBASE_ADMIN credentials are missing in non-emulator mode', async () => {
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    expect(() => getAdminApp()).toThrowError(
      /FIREBASE_ADMIN_PROJECT_ID.*FIREBASE_ADMIN_CLIENT_EMAIL.*FIREBASE_ADMIN_PRIVATE_KEY/,
    );
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it('throws when only some FIREBASE_ADMIN credentials are present in non-emulator mode', async () => {
    process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'only-project';
    process.env['FIREBASE_ADMIN_CLIENT_EMAIL'] = 'svc@x.iam.gserviceaccount.com';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    expect(() => getAdminApp()).toThrowError(/FIREBASE_ADMIN_PRIVATE_KEY/);
    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).not.toHaveBeenCalled();
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
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
    process.env['FIREBASE_ADMIN_PROJECT_ID'] = 'emulator-project';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    getAdminApp();

    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'emulator-project' });
  });

  it('falls back to admin-platform-dev when no project id is available in emulator mode', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp } = await import('./firebase-admin.js');

    getAdminApp();

    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({ projectId: 'admin-platform-dev' });
  });

  it('getAdminAuth/getAdminDb/getAdminStorage bind services to the cached app', async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    getAppsMock.mockReturnValue([]);
    const { getAdminApp, getAdminAuth, getAdminDb, getAdminStorage } =
      await import('./firebase-admin.js');

    const app = getAdminApp();

    expect(getAdminAuth()).toBe(fakeAuth);
    expect(getAdminDb()).toBe(fakeDb);
    expect(getAdminStorage()).toBe(fakeStorage);
    expect(getAuthMock).toHaveBeenCalledWith(app);
    expect(getFirestoreMock).toHaveBeenCalledWith(app);
    expect(getStorageMock).toHaveBeenCalledWith(app);
  });
});
