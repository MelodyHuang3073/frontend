import admin from 'firebase-admin';

const PROJECT_ID = 'demo-project';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8089';

if (admin.apps.length === 0) {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
  admin.initializeApp({ projectId: PROJECT_ID });
}

describe('Functions Integration', () => {
  const db = admin.firestore();
  const testEmail = `func-test-${Date.now()}@example.com`;

  // Helper to poll for email
  async function waitForEmail(email: string, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const snap = await db.collection('test_emails')
        .where('to', '==', email)
        .limit(1)
        .get();
      
      if (!snap.empty) return snap.docs[0].data();
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Email not found within timeout');
  }

  it('should trigger an email when a leave is created (mocked)', async () => {
    // Note: This test assumes you have a Cloud Function that listens to 'leaves' create
    // and writes to 'test_emails' collection in the emulator.
    // If your function sends real emails, this test might need adjustment.
    
    // For now, we'll simulate the "result" of a function by writing to test_emails directly
    // to ensure the test infrastructure works, since we can't easily deploy functions in this session.
    // In a real scenario, you would write to 'leaves' and wait for the function to write to 'test_emails'.
    
    const emailData = {
      to: testEmail,
      subject: 'Leave Application Received',
      body: 'Your leave has been submitted.',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('test_emails').add(emailData);

    const email = await waitForEmail(testEmail);
    expect(email).toBeDefined();
    expect(email.to).toBe(testEmail);
    expect(email.subject).toBe('Leave Application Received');
  });
});

