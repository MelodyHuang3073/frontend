import admin from 'firebase-admin';

const PROJECT_ID = 'demo-project';
const AUTH_EMULATOR_HOST = '127.0.0.1:9197';

if (admin.apps.length === 0) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;
  admin.initializeApp({ projectId: PROJECT_ID });
}

describe('Auth Integration', () => {
  const auth = admin.auth();
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';
  let createdUid: string;

  it('should create a new user', async () => {
    const user = await auth.createUser({
      email: testEmail,
      password: testPassword,
      displayName: 'Test User',
    });
    createdUid = user.uid;
    expect(user.email).toBe(testEmail);
    expect(user.uid).toBeDefined();
  });

  it('should retrieve the created user by email', async () => {
    const user = await auth.getUserByEmail(testEmail);
    expect(user.uid).toBe(createdUid);
  });

  it('should set custom claims (roles)', async () => {
    await auth.setCustomUserClaims(createdUid, { role: 'student' });
    const user = await auth.getUser(createdUid);
    expect(user.customClaims).toEqual({ role: 'student' });
  });
});

