const { spawn } = require('node:child_process');
const path = require('node:path');
// Local UI review uses empty-data states, never the production database.
const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--port', '3001'], {
  stdio: 'inherit', env: { ...process.env, POSTGRES_URL: '', DATABASE_URL: '', NEXT_TELEMETRY_DISABLED: '1' },
});
process.on('SIGINT', () => child.kill());
child.on('exit', code => process.exit(code ?? 0));
