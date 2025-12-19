import compat from 'async-compat';
import fs from 'fs';
import Module from 'module';
import type { InteropMode, ModuleType } from 'module-compat';
import { loadModule } from 'module-compat';
import path from 'path';
import url from 'url';

// ESM worker - uses ESM build of module-compat
// Supports loading both CJS and ESM modules via import()
const _require = Module.createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Require serialize from CJS dist (ESM dist files can't be required on Node 12-22)
const serialize = _require(path.join(__dirname, '..', '..', 'cjs', 'serialize-javascript.js'));

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

  loadModule(workerData.filePath, loadOptions, (err, fn) => {
    if (err) {
      writeError(err as Error & Record<string, unknown>);
      return;
    }

    if (typeof fn !== 'function') {
      writeResult({ value: fn });
    } else {
      const args: unknown[] = [fn, workerData.callbacks, ...workerData.args];
      args.push((err: Error | null, value: unknown) => {
        err ? writeError(err as Error & Record<string, unknown>) : writeResult({ value });
      });
      compat.asyncFunction.apply(null, args as Parameters<typeof compat.asyncFunction>);
    }
  });
} catch (err) {
  writeError(err as Error & Record<string, unknown>);
}
