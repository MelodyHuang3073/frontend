import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'demo';

async function pollForEmail(toEmail: string, timeout = 15000) {
	const db = admin.firestore();
	const start = Date.now();
	while (Date.now() - start < timeout) {
		// use createdAt (number) ordering — functions write createdAt as Date.now()
		const snap = await db.collection('test_emails').where('to', '==', toEmail).orderBy('createdAt', 'desc').limit(5).get();
		if (!snap.empty) return snap.docs.map(d => d.data());
		await new Promise(r => setTimeout(r, 500));
	}
	return null;
}

async function run() {
	admin.initializeApp({ projectId: PROJECT_ID });
	const studentEmail = process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com';
	console.log('Polling for emails to', studentEmail);
	// extend timeout to 60s to allow for emulator function cold starts and retries
	const res = await pollForEmail(studentEmail, 60000);
	if (!res) {
		console.error('No email found within timeout');
		process.exitCode = 2;
		return;
	}
	console.log('Found emails:', res);
}

run().catch(e => { console.error(e); process.exitCode = 1 });

export {};
