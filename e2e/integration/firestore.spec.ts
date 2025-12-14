import admin from 'firebase-admin';

const PROJECT_ID = 'demo-project';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8089'; // Port 8088 as per your config

if (admin.apps.length === 0) {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
  admin.initializeApp({ projectId: PROJECT_ID });
}

describe('Firestore Integration', () => {
  const db = admin.firestore();
  let leaveId: string;

  it('should create a leave application', async () => {
    const leaveData = {
      userId: 'test-student-uid',
      studentEmail: 'student@example.com',
      userName: 'Test Student',
      courseId: 'TEST100',
      startAt: admin.firestore.Timestamp.now(),
      endAt: admin.firestore.Timestamp.fromMillis(Date.now() + 3600000),
      reason: 'Integration test',
      status: 'PENDING',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection('leaves').add(leaveData);
    leaveId = ref.id;
    
    const snap = await ref.get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.status).toBe('PENDING');
  });

  it('should update leave status to APPROVED', async () => {
    const ref = db.collection('leaves').doc(leaveId);
    await ref.update({ 
      status: 'APPROVED',
      approvedBy: 'teacher@example.com',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const snap = await ref.get();
    expect(snap.data()?.status).toBe('APPROVED');
    expect(snap.data()?.approvedBy).toBe('teacher@example.com');
  });
});

