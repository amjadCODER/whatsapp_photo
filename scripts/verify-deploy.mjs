import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const required = [
  'dist/index.html',
  'dist/src/main.js',
  'dist/src/core.js',
  'dist/src/style.css',
  'dist/نموذج-جهات-الاتصال.xlsx'
];

for (const file of required) {
  await access(file, constants.R_OK);
}

const html = await readFile('dist/index.html', 'utf8');
for (const ref of ['./src/main.js', './src/style.css']) {
  if (!html.includes(ref)) {
    throw new Error(`Missing deployment reference: ${ref}`);
  }
}

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
if (Array.isArray(config.rewrites) && config.rewrites.some(x => x.source?.includes('(.*)'))) {
  throw new Error('Catch-all rewrite detected.');
}

console.log('Deployment verification passed.');
