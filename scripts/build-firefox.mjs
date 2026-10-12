// Turns the Chrome build in dist/ into a Firefox build in dist-firefox/.
// The Chrome package is left untouched so it stays identical to the Chrome Web Store upload.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const SRC = 'dist';
const OUT = 'dist-firefox';

if (!existsSync(`${SRC}/manifest.json`)) {
  console.error(`ERROR: ${SRC}/manifest.json not found. Run "npm run build" first.`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });

// Mozilla rebuilds from the source upload on Linux and diffs the result against the package,
// so the output can't depend on whether the source was checked out with CRLF or LF.
for (const file of readdirSync(OUT, { recursive: true })) {
  if (!/\.(css|html|js|json)$/.test(file)) continue;
  const path = `${OUT}/${file}`;
  const text = readFileSync(path, 'utf8');
  if (text.includes('\r')) writeFileSync(path, text.replace(/\r\n?/g, '\n'));
}

const manifest = JSON.parse(readFileSync(`${OUT}/manifest.json`, 'utf8'));
manifest.browser_specific_settings = {
  gecko: {
    // Firefox matches updates to installed copies by this ID, so it must never change once published.
    id: 'sutd-deadline-center@abhishekvulla',
    // data_collection_permissions only exists from Firefox 140.
    strict_min_version: '140.0',
    data_collection_permissions: { required: ['none'] },
  },
};
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');

console.log(`✓ Firefox build written to ${OUT}/ (v${manifest.version})`);
