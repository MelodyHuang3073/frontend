import { execFileSync } from 'child_process';
import path from 'path';

// Global setup: seed the Firebase emulator so tests have predictable data.
// This runs once before the Playwright test suite.
export default async function globalSetup() {
  try {
    const seedScript = path.join(process.cwd(), 'scripts', 'seed-emulator.js');
    // Run with node so environment is the project root
    execFileSync(process.execPath, [seedScript], { stdio: 'inherit' });
  } catch (err) {
    // If seeding fails, log and rethrow so Playwright stops early with clear error.
    // eslint-disable-next-line no-console
    console.error('Global setup: seeding emulator failed:', err);
    throw err;
  }
}
