#!/usr/bin/env node
/**
 * Render the Mermaid blocks in docs/system-design.md to PNGs in docs/diagrams/.
 *
 * Mermaid is the source of truth (it renders on GitHub and diffs cleanly); the
 * PNGs exist for slide decks and docs tools that cannot render Mermaid.
 *
 * Usage: npm run docs:diagrams
 * Requires a Chrome/Chromium binary; set CHROME_PATH if it is not on PATH.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'docs/system-design.md');
const outDir = resolve(root, 'docs/diagrams');

// Diagram order must match the Mermaid blocks in docs/system-design.md.
const NAMES = [
  '01-container',
  '02-auth-sequence',
  '03-kml-ingestion',
  '04-data-model',
  '05-caching',
  '06-deployment',
];

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const candidate of [
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const blocks = [...readFileSync(source, 'utf8').matchAll(/```mermaid\n([\s\S]*?)```/g)].map(
  (m) => m[1]
);

if (blocks.length === 0) {
  console.error('No mermaid blocks found in docs/system-design.md');
  process.exit(1);
}
if (blocks.length !== NAMES.length) {
  console.error(
    `Found ${blocks.length} diagrams but ${NAMES.length} names are configured.\n` +
      'Update NAMES in scripts/render-diagrams.mjs to match.'
  );
  process.exit(1);
}

const chrome = findChrome();
if (!chrome) {
  console.error('No Chrome/Chromium binary found. Set CHROME_PATH and retry.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const work = resolve(tmpdir(), `minearchive-diagrams-${process.pid}`);
mkdirSync(work, { recursive: true });

const puppeteerConfig = resolve(work, 'puppeteer.json');
writeFileSync(
  puppeteerConfig,
  JSON.stringify({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
);

const mermaidConfig = resolve(work, 'mermaid.json');
writeFileSync(
  mermaidConfig,
  JSON.stringify({
    theme: 'neutral',
    themeVariables: { fontFamily: 'Inter, Segoe UI, sans-serif', fontSize: '15px' },
    flowchart: { curve: 'basis' },
  })
);

let failed = 0;
try {
  for (const [i, code] of blocks.entries()) {
    const name = NAMES[i];
    const input = resolve(work, `${name}.mmd`);
    writeFileSync(input, code);

    const result = spawnSync(
      'npx',
      [
        '-y',
        '@mermaid-js/mermaid-cli',
        '-i', input,
        '-o', resolve(outDir, `${name}.png`),
        '-p', puppeteerConfig,
        '-c', mermaidConfig,
        '-b', 'white',
        '-s', '2',
      ],
      { cwd: root, stdio: 'pipe' }
    );

    if (result.status === 0) {
      console.log(`✔ ${name}.png`);
    } else {
      failed++;
      console.error(`✖ ${name} — ${result.stderr?.toString().trim().split('\n').pop()}`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
