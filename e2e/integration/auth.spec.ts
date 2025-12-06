import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'demo';

async function run() {
	admin.initializeApp({ projectId: PROJECT_ID });
	const auth = admin.auth();
	const db = admin.firestore();

	const studentEmail = process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com';
	const teacherEmail = process.env.E2E_TEACHER_EMAIL || 'm101450924@gmail.com';
	const password = process.env.E2E_PASSWORD || 'Aa12345678';

	async function ensureUser(email: string, displayName: string, role: string) {
		try {
			const u = await auth.getUserByEmail(email);
			console.log('User exists:', email, u.uid);
			// ensure corresponding Firestore user doc exists for functions
			try {
				await db.doc(`users/${u.uid}`).set({ email, displayName, role }, { merge: true });
			} catch (e) {
				console.warn('Failed to write users doc for', email, String(e));
			}
			return u.uid;
		} catch (_) {
			const created = await auth.createUser({ email, password, displayName });
			console.log('Created user:', email, created.uid);
			try {
				await db.doc(`users/${created.uid}`).set({ email, displayName, role }, { merge: true });
			} catch (e) {
				console.warn('Failed to write users doc for', email, String(e));
			}
			return created.uid;
		}
	}

	const studentUid = await ensureUser(studentEmail, 'Student Test', 'student');
	const teacherUid = await ensureUser(teacherEmail, 'Teacher Test', 'teacher');

	console.log('Auth setup complete. studentUid=', studentUid, 'teacherUid=', teacherUid);
}

run().catch(e => { console.error(e); process.exitCode = 1 });

export {};
