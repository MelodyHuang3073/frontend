import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import admin from 'firebase-admin';

const PROJECT_ID = 'demo-project';
const STORAGE_EMULATOR_HOST = '127.0.0.1:9198';

if (admin.apps.length === 0) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE_EMULATOR_HOST;
  admin.initializeApp({ projectId: PROJECT_ID });
}

describe('Storage Integration', () => {
  let storage: Storage;
  let bucket: any;
  const bucketName = 'demo-project.appspot.com';

  beforeAll(() => {
    storage = new Storage({
      projectId: PROJECT_ID,
      apiEndpoint: `http://${STORAGE_EMULATOR_HOST}`,
    });
    bucket = storage.bucket(bucketName);
  });

  it('should upload a file to Firebase Storage', async () => {
    const localFile = path.resolve(__dirname, '../fixtures/test-attachment.txt');
    
    if (!fs.existsSync(localFile)) {
       fs.mkdirSync(path.dirname(localFile), { recursive: true });
       fs.writeFileSync(localFile, 'test content');
    }

    const dest = `uploads/test-attachment-${Date.now()}.txt`;
    
    await bucket.upload(localFile, { destination: dest });
    
    const [exists] = await bucket.file(dest).exists();
    expect(exists).toBe(true);

    const [meta] = await bucket.file(dest).getMetadata();
    expect(Number(meta.size)).toBeGreaterThan(0);
  });
});

