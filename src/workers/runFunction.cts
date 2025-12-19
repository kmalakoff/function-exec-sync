// CJS worker - uses CJS build of module-compat
// Only supports loading CJS modules (or ESM on Node 23+ via require)

import type { InteropMode, ModuleType } from 'module-compat';

const compat = require('async-compat');
const fs = require('fs');
const { loadModule } = require('module-compat');
const path = require('path');

const serialize = require(path.join(__dirname, '..', 'serialize-javascript.js'));

const input = process.argv[2];
const output = process.argv[3];

interface WorkerData {
  cwd: string;
  env: Record<string, string>;
  filePath: string;
  callbacks: boolean;
  args: unknown[];
  moduleType?: 'auto' | ModuleType;
  interop?: InteropMode;
}

interface ResultValue {
  value?: unknown;
  error?: {
    message: string;
    stack?: string;
    [key: string]: unknown;
  };
}

function writeResult(result: ResultValue): void {
  fs.writeFile(output, serialize(result), 'utf8', () => {
    process.exit(0);
  });
}

function writeError(error: Error & Record<string, unknown>): void {
  const errorObj: ResultValue['error'] = { message: error.message, stack: error.stack };
  for (const key in error) errorObj[key] = error[key];
  writeResult({ error: errorObj });
}

// get data
try {
  // biome-ignore lint/security/noGlobalEval: Deserialize worker data
  const workerData: WorkerData = eval(`(${fs.readFileSync(input, 'utf8')})`);

  // set up env
  if (process.cwd() !== workerData.cwd) process.chdir(workerData.cwd);
  for (const key in workerData.env) process.env[key] = workerData.env[key];

  // load and call function
  const loadOptions = {
    moduleType: workerData.moduleType || 'auto',
    interop: workerData.interop || 'default',
  };

  loadModule(workerData.filePath, loadOptions, (err: Error | null, fn: unknown) => {
    if (err) {
      writeError(err as Error & Record<string, unknown>);
      return;
    }

    if (typeof fn !== 'function') {
      writeResult({ value: fn });
    } else {
      const args: unknown[] = [fn as unknown, workerData.callbacks as unknown].concat(workerData.args);
      args.push((err: Error | null, value: unknown) => {
        err ? writeError(err as Error & Record<string, unknown>) : writeResult({ value });
      });
      compat.asyncFunction.apply(null, args);
    }
  });
} catch (err) {
  writeError(err as Error & Record<string, unknown>);
}
