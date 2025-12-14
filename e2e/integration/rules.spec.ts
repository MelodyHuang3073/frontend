import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment, assertSucceeds, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-project';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8089';

describe('Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Load rules from file
    const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
    
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8089,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('should allow authenticated user to create their own leave', async () => {
    const alice = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' });
    
    await assertSucceeds(alice.firestore().collection('leaves').add({
      userId: 'alice-uid',
      studentEmail: 'alice@example.com',
      status: 'PENDING',
      createdAt: new Date(),
      reason: 'Sick leave'
    }));
  });

  it('should deny unauthenticated user from creating leave', async () => {
    const guest = testEnv.unauthenticatedContext();
    
    await assertFails(guest.firestore().collection('leaves').add({
      userId: 'some-uid',
      status: 'PENDING'
    }));
  });

  it('should deny user from creating leave for others', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    
    await assertFails(alice.firestore().collection('leaves').add({
      userId: 'bob-uid', // Mismatch
      status: 'PENDING'
    }));
  });
});

