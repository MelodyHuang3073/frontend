#!/usr/bin/env node
// seed-emulator.js - minimal seeding for emulator: create student and teacher users and simple course/enrollment
const fetch = require('node-fetch');
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9197';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8087';
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo';

// Use Admin SDK for Firestore writes so seeding isn't blocked by security rules
const admin = require('firebase-admin');
if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
admin.initializeApp({ projectId });
const db = admin.firestore();

const student = { email: 'y920531@gmail.com', password: 'Aa12345678', displayName: 'Student Test', role: 'student' };
const teacher = { email: 'm101450924@gmail.com', password: 'Aa12345678', displayName: 'Teacher Test', role: 'teacher' };

async function createAuthUser(email, password) {
  const url = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`;
  const body = { email, password, returnSecureToken: true };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth create failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.localId || data.uid;
}

async function setUserDoc(uid, userObj) {
  // Use Admin SDK to write users/{uid} so emulator rules don't block us
  await db.collection('users').doc(uid).set(userObj, { merge: true });
  return { success: true };
}

async function createCourse(code = 'TEST100', name = '自動化測試課程', teacherUid) {
  const ref = db.collection('course').doc();
  const data = { code, name, teacherUid: teacherUid || '' };
  await ref.set(data);
  return { id: ref.id, fields: { code: { stringValue: code } } };
}

async function createEnrollment(studentUid, courseCode) {
  const ref = db.collection('enrollments').doc();
  await ref.set({ studentUid, courseCode });
  return { id: ref.id };
}

(async () => {
  try {
    console.log('Seeding emulator (project:', projectId, ')');
    let studentUid, teacherUid;
    try {
      studentUid = await createAuthUser(student.email, student.password);
      console.log('Created student auth uid:', studentUid);
    } catch (e) {
      console.warn('Student auth creation may have failed (exists?):', e.message);
    }
    try {
      teacherUid = await createAuthUser(teacher.email, teacher.password);
      console.log('Created teacher auth uid:', teacherUid);
    } catch (e) {
      console.warn('Teacher auth creation may have failed (exists?):', e.message);
    }

    if (studentUid) await setUserDoc(studentUid, { email: student.email, displayName: student.displayName, role: student.role });
    if (teacherUid) await setUserDoc(teacherUid, { email: teacher.email, displayName: teacher.displayName, role: teacher.role });

    let course;
    if (teacherUid) {
      course = await createCourse('TEST100', '自動化測試課程', teacherUid);
      console.log('Created course');
    }
    if (studentUid) {
      const courseCode = (course && course.fields && course.fields.code && course.fields.code.stringValue) ? course.fields.code.stringValue : 'TEST100';
      await createEnrollment(studentUid, courseCode);
      console.log('Created enrollment for', studentUid);
    }
    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed', err);
    process.exit(1);
  }
})();
