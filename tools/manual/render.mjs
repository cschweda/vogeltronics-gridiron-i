#!/usr/bin/env node
/**
 * Render the Gridiron Owner's Manual to PDF with headless Chrome.
 *
 * The PDF is COMMITTED as a static asset (public/gridiron-manual.pdf), so the
 * Netlify build never needs Chrome. Re-run this only when manual.html changes:
 *
 *   npm run manual
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

const SOURCE = resolve(here, 'manual.html');
const OUTPUT = resolve(repo, 'public', 'gridiron-manual.pdf');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error('No Chrome or Chromium found. Install one, or add its path to CHROME_CANDIDATES.');
  process.exit(1);
}

execFileSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    // The manual pulls the logo and box art off disk.
    '--allow-file-access-from-files',
    '--no-pdf-header-footer',
    // Give the SVG and images time to lay out before the snapshot.
    '--virtual-time-budget=4000',
    `--print-to-pdf=${OUTPUT}`,
    `file://${SOURCE}`,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

if (!existsSync(OUTPUT)) {
  console.error('Chrome exited without writing a PDF.');
  process.exit(1);
}

const kb = (statSync(OUTPUT).size / 1024).toFixed(0);
console.log(`wrote ${OUTPUT} (${kb} kB)`);
