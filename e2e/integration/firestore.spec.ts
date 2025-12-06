import admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'demo';

async function run() {
	admin.initializeApp({ projectId: PROJECT_ID });
	const db = admin.firestore();

	const studentEmail = process.env.E2E_STUDENT_EMAIL || 'y920531@gmail.com';
	const teacherEmail = process.env.E2E_TEACHER_EMAIL || 'm101450924@gmail.com';

	// Resolve users if present
	let studentUid = null;
	let teacherUid = null;
	try { studentUid = (await admin.auth().getUserByEmail(studentEmail)).uid; } catch (e) { console.warn('No student auth:', String(e)); }
	try { teacherUid = (await admin.auth().getUserByEmail(teacherEmail)).uid; } catch (e) { console.warn('No teacher auth:', String(e)); }

	const leaveRef = await db.collection('leaves').add({
		userId: studentUid,
		studentEmail,
		userName: 'Test Student',
		courseId: 'TEST100',
		assignedTeacherUid: teacherUid,
		startAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600 * 1000)),
		endAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 3600 * 1000)),
		reason: 'Integration test leave',
		status: 'PENDING',
		createdAt: admin.firestore.FieldValue.serverTimestamp()
	});

	console.log('Created leave id:', leaveRef.id);

	// Approve
	await leaveRef.update({ status: 'approved', approvedBy: teacherEmail, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
	const snap = await leaveRef.get();
	console.log('Leave after approve:', snap.data());
}

run().catch(e => { console.error(e); process.exitCode = 1 });

export {};
