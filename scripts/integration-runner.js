const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
	'e2e/integration/auth.spec.ts',
	'e2e/integration/firestore.spec.ts',
	'e2e/integration/functions.spec.ts',
	'e2e/integration/storage.spec.ts',
	'e2e/integration/rules.spec.ts'
];

function runScript(script) {
	console.log('\n=== Running:', script, '===');
	const node = process.execPath;
	const args = ['-r', 'ts-node/register', path.join(process.cwd(), script)];
	const env = Object.assign({}, process.env, { TS_NODE_TRANSPILE_ONLY: 'true' });
	const res = spawnSync(node, args, { stdio: 'inherit', env });
	if (res.error) throw res.error;
	if (res.status !== 0) throw new Error(`Script ${script} exited ${res.status}`);
}

(async function main(){
	try {
		for (const t of tests) {
			// skip if file doesn't exist
			const full = path.join(process.cwd(), t);
			try { runScript(t); } catch (e) { console.error('Failed test:', t, e && e.message); throw e; }
		}
		console.log('\nAll integration scripts finished successfully');
		process.exit(0);
	} catch (err) {
		console.error('\nIntegration runner failed:', err && err.message);
		process.exit(2);
	}
})();
