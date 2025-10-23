#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'cors.json');

if (!fs.existsSync(filePath)) {
  console.error('cors.json not found at', filePath);
  process.exit(1);
}

try {
  // Read raw buffer and try to detect BOMs
  const buf = fs.readFileSync(filePath);

  // If buffer starts with UTF-16 LE BOM (0xFF 0xFE) or UTF-16 BE (0xFE 0xFF), convert
  let content;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    // UTF-16 LE
    content = buf.toString('utf16le');
  } else if (buf[0] === 0xfe && buf[1] === 0xff) {
    // UTF-16 BE
    // Node doesn't directly support utf16be; swap bytes then decode as utf16le
    const swapped = Buffer.allocUnsafe(buf.length - 2);
    for (let i = 2; i < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1] || 0x00;
      swapped[i - 1] = buf[i] || 0x00;
    }
    content = swapped.toString('utf16le');
  } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    // UTF-8 BOM
    content = buf.slice(3).toString('utf8');
  } else {
    // Assume it's already UTF-8 or ANSI; try utf8 first, fallback to latin1
    try {
      content = buf.toString('utf8');
      // quick JSON parse check
      JSON.parse(content);
    } catch (e) {
      // fallback: treat as latin1 and convert to utf8
      content = Buffer.from(buf.toString('latin1'), 'latin1').toString('utf8');
    }
  }

  // Normalize JSON formatting
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse cors.json as JSON after decoding:', e.message);
    process.exit(2);
  }

  const out = JSON.stringify(parsed, null, 2);

  // Write UTF-8 without BOM
  fs.writeFileSync(filePath, out, { encoding: 'utf8' });
  console.log('Rewrote cors.json as UTF-8 (no BOM) at', filePath);
} catch (err) {
  console.error('Error converting cors.json:', err);
  process.exit(3);
}
