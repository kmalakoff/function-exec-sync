/**
 * Compatibility Layer for Node.js 0.8+
 * Local to this package - contains only needed functions.
 */
import fs from 'fs';
import os from 'os';

export function tmpdir(): string {
  return typeof os.tmpdir === 'function' ? os.tmpdir() : require('os-shim').tmpdir();
}

export function existsSync(test: string): boolean {
  try {
    (fs.accessSync || fs.statSync)(test);
    return true;
  } catch (_) {
    return false;
  }
}
