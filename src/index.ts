import { ProcessEnvOptions } from 'child_process';

require('./polyfills.ts');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const tmpdir = require('os').tmpdir || require('os-shim').tmpdir;
const suffix = require('temp-suffix');
const serialize = require('serialize-javascript');
const mkdirp = require('mkdirp-classic');
const shortHash = require('short-hash');
const sleep = require('thread-sleep-compat');

const DEFAULT_SLEEP_MS = 100;
const NODES = ['node', 'node.exe', 'node.cmd'];
const isWindows = process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE);

const unlinkSafe = require('./unlinkSafe.ts');

export type ExecWorkerOptions = {
  name?: string;
  cwd?: string;
  env?: object;
  callbacks?: boolean;
  execPath?: string;
  sleep?: number;
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export default function functionExecSync(options: ExecWorkerOptions, filePath: string, ...args): any {
  const workerData = {
    filePath,
    args,
    callbacks: options.callbacks || false,
    env: options.env || process.env,
    cwd: options.cwd === undefined ? process.cwd() : options.cwd,
  };

  const name = options.name === undefined ? 'exec-worker-sync' : options.name;
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
  const worker = path.join(__dirname, 'worker.js');

  // only node
  if (NODES.indexOf(path.basename(execPath).toLowerCase()) < 0) throw new Error(`Expecting node executable. Received: ${path.basename(execPath)}`);

  // exec and start polling
  if (!cp.execFileSync) {
    const sleepMS = options.sleep === undefined ? DEFAULT_SLEEP_MS : options.sleep;
    let cmd = `"${execPath}" "${worker}" "${input}" "${output}"`;
    cmd += `${isWindows ? '&' : ';'} echo "done" > ${done}`;
    cp.exec(cmd);
    while (!fs.existsSync(done)) {
      sleep(sleepMS);
    }
  } else {
    cp.execFileSync(execPath, [worker, input, output]);
  }
  unlinkSafe(input);
  unlinkSafe(done);

  // get data and clean up
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let res: { error: { [x: string]: any; message: string }; value: any };
  try {
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
