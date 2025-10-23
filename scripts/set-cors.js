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

    // Update this if your firebase config uses a different bucket
    const BUCKET_NAME = 'software-engineering-edc96.appspot.com';

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
