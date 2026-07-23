import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const files = [
  'dist/index.html',
  'dist/src/main.js',
  'dist/src/core.js',
  'dist/src/style.css',
  'dist/نموذج-جهات-الاتصال.xlsx'
];

for (const file of files) {
  await access(file, constants.R_OK);
}

const html = await readFile('dist/index.html', 'utf8');
const main = await readFile('dist/src/main.js', 'utf8');
const css = await readFile('dist/src/style.css', 'utf8');

assert.match(html, /id="app"/);
assert.match(html, /جاري تحميل النظام/);
assert.match(html, /src="\.\/src\/main\.js"/);
assert.match(html, /rel="stylesheet" href="\.\/src\/style\.css"/);
assert.doesNotMatch(html, /xlsx\.full\.min\.js/);
assert.match(main, /function loadExcelLibrary/);
assert.doesNotMatch(main, /import\s+['"]\.\/style\.css['"]/);
assert.match(main, /try\s*\{\s*render\(\)/);
assert.match(main, /دخول المؤسسة/);
assert.match(css, /\.login-shell/);

console.log('Static browser boot test passed.');
