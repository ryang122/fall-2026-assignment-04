#!/usr/bin/env node
// Validates a Mermaid ERD and compiles it to docs/architecture/erd.svg via mmdc.
// Usage: node scripts/render_erd.js docs/architecture/schema.mmd
//   SUCCESS              -> exit 0
//   SYNTAX_ERROR: <trace> -> exit 1

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script_dir = path.dirname(fileURLToPath(import.meta.url));
// .agent/skills/erd-generator/scripts -> repo root
const repo_root = path.resolve(script_dir, '..', '..', '..', '..');

function fail(message) {
  console.error(`SYNTAX_ERROR: ${message.trim()}`);
  process.exit(1);
}

// Resolve the input against the cwd first, then the repo root, so the script
// works whether it is invoked from the repo root or the skill directory.
function resolve_input(arg) {
  const candidates = [path.resolve(process.cwd(), arg), path.resolve(repo_root, arg)];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile());
}

const input_arg = process.argv[2] ?? 'docs/architecture/schema.mmd';
const input_path = resolve_input(input_arg);
if (!input_path) {
  fail(`Input file not found: ${input_arg}`);
}

const output_dir = path.join(repo_root, 'docs', 'architecture');
const output_path = path.join(output_dir, 'erd.svg');
mkdirSync(output_dir, { recursive: true });

// Chromium refuses to start as root / inside WSL & containers without these flags.
const puppeteer_config = path.join(tmpdir(), `erd-puppeteer-${process.pid}.json`);
writeFileSync(puppeteer_config, JSON.stringify({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }));

// Remove any stale render so success is only reported for a fresh SVG.
rmSync(output_path, { force: true });

const result = spawnSync(
  'npx',
  ['--no-install', 'mmdc', '-i', input_path, '-o', output_path, '-p', puppeteer_config, '-q'],
  { cwd: repo_root, encoding: 'utf8', shell: process.platform === 'win32' },
);

rmSync(puppeteer_config, { force: true });

if (result.error) {
  fail(result.error.message);
}
if (result.status !== 0 || !existsSync(output_path)) {
  fail(result.stderr || result.stdout || `mmdc exited with code ${result.status}`);
}

console.log('SUCCESS');
process.exit(0);
