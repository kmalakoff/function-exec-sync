import compat from 'async-compat';
import fs from 'fs';
import Module from 'module';
import path from 'path';
import url from 'url';

// CJS/ESM compatibility
const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;
const __dirname = path.dirname(typeof __filename !== 'undefined' ? __filename : url.fileURLToPath(import.meta.url));

// Worker path is relative to dist/cjs/workers/ at runtime
const serialize = _require(path.join(__dirname, '..', 'serialize-javascript.js'));

const input = process.argv[2];
const output = process.argv[3];

interface WorkerData {
  cwd: string;
  env: Record<string, string>;
  filePath: string;
  callbacks: boolean;
  args: unknown[];
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
  const result: ResultValue = { error: { message: error.message, stack: error.stack } };
  for (const key in error) result.error![key] = error[key];
  writeResult(result);
}

// get data
try {
  // biome-ignore lint/security/noGlobalEval: Serialize
  const workerData: WorkerData = eval(`(${fs.readFileSync(input, 'utf8')})`);

  // set up env
  if (process.cwd() !== workerData.cwd) process.chdir(workerData.cwd);
  for (const key in workerData.env) process.env[key] = workerData.env[key];

  // call function
  const fn = _require(workerData.filePath);
  if (typeof fn !== 'function') {
    writeResult({ value: fn });
  } else {
    const args: unknown[] = [fn, workerData.callbacks].concat(workerData.args);
    args.push((err: Error | null, value: unknown) => {
      err ? writeError(err as Error & Record<string, unknown>) : writeResult({ value });
    });
    compat.asyncFunction.apply(null, args as Parameters<typeof compat.asyncFunction>);
  }
} catch (err) {
  writeError(err as Error & Record<string, unknown>);
}
