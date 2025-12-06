import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'demo';

async function run() {
	admin.initializeApp({ projectId: PROJECT_ID });
	const emulatorHost = process.env.STORAGE_EMULATOR_HOST;
	if (!emulatorHost) {
		console.warn('Storage emulator not configured (STORAGE_EMULATOR_HOST not set). Skipping storage spec.');
		return;
	}
	const bucketName = process.env.TEST_STORAGE_BUCKET || `demo-bucket`;

	const storage = new Storage({ projectId: PROJECT_ID });
	const bucket = storage.bucket(bucketName);

	const localFile = path.resolve(process.cwd(), 'e2e', 'fixtures', 'test-attachment.txt');
	if (!fs.existsSync(localFile)) { fs.mkdirSync(path.dirname(localFile), { recursive: true }); fs.writeFileSync(localFile, 'test'); }

	const dest = `uploads/test-attachment-${Date.now()}.txt`;
	await bucket.upload(localFile, { destination: dest });
	console.log('Uploaded to', dest);
	const [meta] = await bucket.file(dest).getMetadata();
	console.log('Metadata name/size:', meta.name, meta.size);
}

run().catch(e => { console.error(e); process.exitCode = 1 });

export {};
