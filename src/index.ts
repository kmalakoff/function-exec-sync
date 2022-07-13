require('./polyfills.ts');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const tmpdir = require('os').tmpdir || require('os-shim').tmpdir;
const suffix = require('temp-suffix');
const serialize = require('serialize-javascript');
const mkdirp = require('mkdirp');
const shortHash = require('short-hash');
const sleep = require('thread-sleep-compat');

const DEFAULT_SLEEP_MS = 100;
const ALLOWED_EXEC_PATH = ['node', 'node.exe', 'node.cmd'];

// @ts-ignore
const unlinkSafe = require('./unlinkSafe.ts');

export type ExecWorkerOptions = {
  name?: string;
  cwd?: string;
  env?: string;
  execPath?: string;
  sleep?: number;
};

export default function functionExecSync(options: ExecWorkerOptions, filePath: string /* arguments */): any {
  const args = Array.prototype.slice.call(arguments, 2);
  const workerData = { filePath, args, env: options.env ?? process.env, cwd: options.cwd ?? process.cwd() };

  const name = options.name ?? 'exec-worker-sync';
  const temp = path.join(tmpdir(), name, shortHash(workerData.cwd));
  const input = path.join(temp, suffix('input'));
  const output = path.join(temp, suffix('output'));

  // store data to a file
  mkdirp.sync(path.dirname(input));
  fs.writeFileSync(input, serialize(workerData), 'utf8');
  unlinkSafe(output);

  // call the function
  const execPath = options.execPath || process.execPath;
  const worker = path.join(__dirname, 'worker.js');

  // only node
  if (ALLOWED_EXEC_PATH.indexOf(path.basename(execPath).toLowerCase()) < 0) throw new Error(`Expecting node executable. Received: ${path.basename(execPath)}`);

  // use polling
  if (!cp.execFileSync) {
    // make sure the file exists
    if (execPath !== process.execPath) require('fs-access-sync-compat')(execPath);

    // exec and start polling
    const sleepMS = options.sleep ?? DEFAULT_SLEEP_MS;
    cp.exec(`"${execPath}" "${worker}" "${input}" "${output}"`);
    while (!fs.existsSync(output)) {
      sleep(sleepMS);
    }
  } else {
    cp.execFileSync(execPath, [worker, input, output]);
  }

  // get data and clean up
  const res = eval(`(${fs.readFileSync(output, 'utf8')})`);
  unlinkSafe(input);
  unlinkSafe(output);

  // throw error from the worker
  if (res.error) {
    const err = new Error(res.error.message);
    if (res.error.stack) err.stack = res.error.stack;
    throw err;
  }
  return res.value;
}
