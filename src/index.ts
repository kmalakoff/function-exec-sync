import './polyfills.cjs';
import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import url from 'url';
import mkdirp from 'mkdirp-classic';
import serialize from 'serialize-javascript';
import shortHash from 'short-hash';
import suffix from 'temp-suffix';
import sleep from 'thread-sleep-compat';

import os from 'os';
import osShim from 'os-shim';
const tmpdir = os.tmpdir || osShim.tmpdir;

const DEFAULT_SLEEP_MS = 100;
const NODES = ['node', 'node.exe', 'node.cmd'];
const isWindows = process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE);
const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const worker = path.join(__dirname, 'workers', 'runFunction.cjs');

import unlinkSafe from './unlinkSafe.js';

const existsSync = (test) => {
  try {
    (fs.accessSync || fs.statSync)(test);
    return true;
  } catch (_) {
    return false;
  }
};

import type { ExecWorkerOptions } from './types.js';
export type * from './types.js';
export default function functionExecSync(options: ExecWorkerOptions, filePath: string, ...args): unknown {
  if (typeof options === 'string') {
    args.unshift(filePath);
    filePath = options;
    options = null;
  }
  if (!filePath) throw new Error('function-exec-sync missing file');
  options = options || {};

  const env = { ...(options.env || process.env) };
  // @ts-ignore
  delete env.NODE_OPTIONS;
  const workerData = {
    filePath,
    args,
    callbacks: options.callbacks === undefined ? false : options.callbacks,
    env,
    cwd: options.cwd === undefined ? process.cwd() : options.cwd,
  };

  const name = options.name === undefined ? 'function-exec-sync' : options.name;
  const temp = path.join(tmpdir(), name, shortHash(workerData.cwd));
  const input = path.join(temp, suffix('input'));
  const output = path.join(temp, suffix('output'));
  const done = path.join(temp, suffix('done'));

  // store data to a file
  mkdirp.sync(path.dirname(input));
  fs.writeFileSync(input, serialize(workerData), 'utf8');
  unlinkSafe(output);

  // call the function
  const execPath = options.execPath || process.execPath;

  // only node
  if (NODES.indexOf(path.basename(execPath).toLowerCase()) < 0) throw new Error(`Expecting node executable. Received: ${path.basename(execPath)}`);

  // exec and start polling
  if (!cp.execFileSync) {
    const sleepMS = options.sleep === undefined ? DEFAULT_SLEEP_MS : options.sleep;
    let cmd = `"${execPath}" "${worker}" "${input}" "${output}"`;
    cmd += `${isWindows ? '&' : ';'} echo "done" > ${done}`;
    cp.exec(cmd, { env });
    while (!existsSync(done)) {
      sleep(sleepMS);
    }
  } else {
    cp.execFileSync(execPath, [worker, input, output], { env });
  }
  unlinkSafe(input);
  unlinkSafe(done);

  // get data and clean up
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let res: { error: { [x: string]: any; message: string }; value: any };
  try {
    // biome-ignore lint/security/noGlobalEval: <explanation>
    res = eval(`(${fs.readFileSync(output, 'utf8')})`);
    unlinkSafe(output);
  } catch (err) {
    throw new Error(`function-exec-sync: Error: ${err.message}. Function: ${filePath}. Exec path: ${execPath}`);
  }

  // throw error from the worker
  if (res.error) {
    const error = new Error(res.error.message);
    for (const key in res.error) error[key] = res.error[key];
    throw error;
  }
  // return the result
  return res.value;
}
