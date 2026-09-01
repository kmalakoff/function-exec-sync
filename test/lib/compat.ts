import fs from 'fs';
import Module from 'module';
import path from 'path';
import url from 'url';

// Use existing require in CJS, or createRequire in ESM (Node 12.2+)
const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;

const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const packageRoot = path.join(__dirname, '..', '..');

export function tmpdir(): string {
  return path.join(packageRoot, '.tmp');
}

/**
 * Create a directory recursively.
 * Uses native fs.mkdirSync({recursive}) on Node 10.12+, falls back to mkdirp-classic.
 */
const hasRecursiveMkdir = +process.versions.node.split('.')[0] >= 10;
export function mkdirRecursive(dir: string): void {
  if (hasRecursiveMkdir) fs.mkdirSync(dir, { recursive: true }) as undefined as undefined;
  const mkdirp = _require('mkdirp-classic');
  mkdirp.sync(dir);
}

/**
 * Copy a file.
 * Uses native fs.copyFileSync on Node 8.5+, falls back to fs-copy-compat.
 */
const hasCopyFileSync = typeof fs.copyFileSync === 'function';
export function copyFileSync(src: string, dest: string): void {
  if (hasCopyFileSync) return fs.copyFileSync(src, dest);
  const copy = _require('fs-copy-compat');
  copy.copyFileSync(src, dest);
}
