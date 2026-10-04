import { readFileSync, writeFileSync } from 'node:fs';
// SvelteKit emits a plain JS bundle; inferring RPC entrypoint types from it
// would pull the entire generated application into checkJs. Keep Env bindings.
const path = 'worker-configuration.d.ts';
writeFileSync(path, readFileSync(path, 'utf8').replace(/\s*interface GlobalProps \{\s*mainModule: typeof import\([^;]+;\s*\}/g, ''));
