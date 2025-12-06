const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'demo';

async function main() {
  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  const snap = await db.collection('test_emails').orderBy('createdAt', 'desc').get();
  const out = [];
  snap.forEach(d => {
    out.push({ id: d.id, ...d.data() });
  });

  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
  const outPath = path.join(artifactsDir, 'test_emails.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Exported', out.length, 'emails to', outPath);
}

main().catch(err => { console.error(err); process.exitCode = 1 });
