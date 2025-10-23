#!/usr/bin/env node
/**
 * set-cors.js
 *
 * Usage:
 * 1. Create or obtain a service account JSON key with Storage Admin permissions.
 * 2. In PowerShell:
 *    $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
 *    npm install @google-cloud/storage
 *    node ./scripts/set-cors.js
 *
 * The script reads ../cors.json and applies it to the bucket configured in the Firebase
 * client config (storage bucket name is set below). Adjust BUCKET_NAME if needed.
 */

const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

async function main() {
  try {
    const repoRoot = path.join(__dirname, '..');
    const corsFile = path.join(repoRoot, 'cors.json');

    if (!fs.existsSync(corsFile)) {
      console.error('cors.json not found at', corsFile);
      process.exit(1);
    }

    const corsRaw = fs.readFileSync(corsFile, 'utf8');
    const cors = JSON.parse(corsRaw);

    // Determine bucket name in this order:
    // 1) Environment variable BUCKET_NAME
    // 2) storageBucket value in src/firebase/config.ts (if present)
    // 3) Hardcoded fallback
    let BUCKET_NAME = process.env.BUCKET_NAME || '';

    if (!BUCKET_NAME) {
      // Try to read the firebase client config file to extract storageBucket
      try {
        const firebaseConfigPath = path.join(repoRoot, 'src', 'firebase', 'config.ts');
        if (fs.existsSync(firebaseConfigPath)) {
          const cfg = fs.readFileSync(firebaseConfigPath, 'utf8');
          const m = cfg.match(/storageBucket:\s*['"]([^'"]+)['"]/);
          if (m && m[1]) BUCKET_NAME = m[1];
        }
      } catch (e) {
        // ignore and fallback
      }
    }

    if (!BUCKET_NAME) {
      // Update this if your firebase config uses a different bucket
      // Use the specified firebasestorage.app bucket by default per user request
      BUCKET_NAME = 'gs://software-engineering-edc96.firebasestorage.app';
    }

    // If we read a bucket name like "software-engineering-edc96.appspot.com" from
    // the firebase client config, normalize it to a gs:// URL so Storage.bucket()
    // works consistently.
    if (!BUCKET_NAME.startsWith('gs://') && /^[^/]+\.[^/]+$/.test(BUCKET_NAME)) {
      BUCKET_NAME = 'gs://' + BUCKET_NAME;
    }

    const storage = new Storage();
    const bucket = storage.bucket(BUCKET_NAME);

    console.log('Applying CORS to bucket:', BUCKET_NAME);
    console.log('CORS payload:', JSON.stringify(cors, null, 2));

    await bucket.setMetadata({ cors });

    // Read back metadata to confirm
    const [metadata] = await bucket.getMetadata();
    console.log('Updated bucket metadata.cors:', JSON.stringify(metadata.cors, null, 2));
    console.log('CORS applied successfully. Please retry your browser upload and check DevTools for the OPTIONS response headers.');
  } catch (err) {
    console.error('Failed to apply CORS:', err);
    process.exit(2);
  }
}

main();
