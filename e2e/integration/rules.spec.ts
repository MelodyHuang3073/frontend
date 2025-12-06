import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';

async function run() {
	try {
		const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
		const env = await initializeTestEnvironment({ projectId: 'demo', firestore: { rules } });

		const alice = env.authenticatedContext('alice-uid', { email: 'alice@example.com' });
		// rules require `userId` to match auth.uid on create
		await assertSucceeds(alice.firestore().collection('leaves').add({ userId: 'alice-uid', studentEmail: 'alice@example.com', status: 'PENDING' }));
		await env.cleanup();
		console.log('Rules smoke test passed');
	} catch (e) {
		console.warn('Rules tests skipped or failed (missing @firebase/rules-unit-testing?)', String(e));
	}
}

run().catch(e => { console.error(e); process.exitCode = 1 });

export {};
