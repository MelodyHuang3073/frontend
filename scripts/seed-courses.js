#!/usr/bin/env node
/**
 * seed-courses.js
 *
 * Usage:
 * 1. Create a Firebase service account JSON and set GOOGLE_APPLICATION_CREDENTIALS
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\service-account.json'
 * 2. npm install firebase-admin
 * 3. node ./scripts/seed-courses.js
 */

const admin = require('firebase-admin');

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path');
    process.exit(1);
  }

  admin.initializeApp();
  const db = admin.firestore();

  const courses = [
    {
      code: 'CS101',
      name: '程式設計入門',
      uid: '04iFlLoNNfNBgRNNViufJZ2YvWr2',
      location: 'A101',
      schedule: 'Mon 09:00-10:30'
    },
    {
      code: 'CS102',
      name: '資料結構',
      uid: '04iFlLoNNfNBgRNNViufJZ2YvWr2',
      location: 'B202',
      schedule: 'Tue 10:40-12:10'
    },
    {
      code: 'CS201',
      name: '作業系統',
      uid: '04iFlLoNNfNBgRNNViufJZ2YvWr2',
      location: 'C303',
      schedule: 'Wed 13:30-15:00'
    },
    {
      code: 'CS202',
      name: '資料庫系統',
      uid: '04iFlLoNNfNBgRNNViufJZ2YvWr2',
      location: 'D404',
      schedule: 'Thu 09:00-10:30'
    },
    {
      code: 'CS301',
      name: '軟體工程',
      uid: '04iFlLoNNfNBgRNNViufJZ2YvWr2',
      location: 'E505',
      schedule: 'Fri 14:00-15:30'
    }
  ];
  // define teachers mapping (ensure these users exist)
  const teachers = [
    { uid: '56dkec8SaDbbsPgaoLO6UDMNOFC3', username: 'Justin_Y' },
    { uid: 's46sQ7kVt8aqha2SVF4caQIjUQJ3', username: 'tinalin@g.ncu.edu.tw' },
    { uid: '04iFlLoNNfNBgRNNViufJZ2YvWr2', username: 'Teacher' }
  ];

  try {
    // Upsert teacher user documents
    console.log('Upserting teacher user documents...');
    for (const t of teachers) {
      await db.collection('users').doc(t.uid).set({
        uid: t.uid,
        username: t.username,
        role: 'teacher',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('Upserted teacher', t.username);
    }

    // Write courses, mapping course.uid to teacher object
    for (const c of courses) {
      const teacherUid = c.uid;
      const teacherObj = teachers.find(t => t.uid === teacherUid) || { uid: teacherUid, username: 'Unknown' };
      const ref = db.collection('courses').doc(c.code);
      await ref.set({
        name: c.name,
        teacher: { uid: teacherObj.uid, username: teacherObj.username },
        location: c.location,
        schedule: c.schedule,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Wrote course', c.code, '-> teacher', teacherObj.username);
    }

    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed', err);
    process.exit(2);
  }
}

main();
