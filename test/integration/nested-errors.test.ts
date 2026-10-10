import assert from 'assert';
import call from 'function-exec-sync';
import { supportsESM } from 'module-compat';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const DATA = path.join(__dirname, '..', 'data');
const canLoadESM = supportsESM();

describe('nested callback errors', () => {
  ['default', 'cjs'].forEach((route) => {
    it(`preserves nested callback errors through the ${route} worker`, () => {
      const values = {
        operation: 'operation "quoted" </script>\u2028',
        operationStack: 'operation stack </script>',
        cleanup: 'cleanup failed',
        cleanupStack: 'cleanup stack',
        inner: 'nested failure',
        innerStack: 'nested stack',
      };
      // A different spelling of the same executable selects CJS without copying Node.
      const execPath = route === 'default' ? process.execPath : `${path.dirname(process.execPath) + path.sep}.${path.sep}${path.basename(process.execPath)}`;
      let caught: unknown;
      try {
        call({ callbacks: true, execPath }, path.join(DATA, 'nestedCallbackError.cjs'), values);
      } catch (error) {
        caught = error;
      }
      assert.ok(caught instanceof Error);
      const error = caught as Error & { errors: (Error & { status?: number; stderr?: string; code?: string; path?: string; details?: { error: Error } })[]; worker: string; pid: number };
      assert.equal(error.message, 'operation and cleanup failed');
      assert.notEqual(error.pid, process.pid);
      assert.equal(path.basename(error.worker), route === 'default' && canLoadESM ? 'runFunction.mjs' : 'runFunction.cjs');
      assert.equal(error.errors.length, 2);
      const operation = error.errors[0];
      const cleanup = error.errors[1];
      assert.ok(operation instanceof Error);
      assert.equal(operation.name, 'OperationFailure');
      assert.equal(operation.message, values.operation);
      assert.equal(operation.stack, values.operationStack);
      assert.equal(operation.status, 17);
      assert.equal(operation.stderr, values.operation);
      assert.ok(operation.details && operation.details.error instanceof Error);
      assert.equal(operation.details?.error.message, values.inner);
      assert.equal(operation.details?.error.stack, values.innerStack);
      assert.ok(cleanup instanceof Error);
      assert.equal(cleanup.name, 'CleanupFailure');
      assert.equal(cleanup.message, values.cleanup);
      assert.equal(cleanup.stack, values.cleanupStack);
      assert.equal(cleanup.code, 'ENOENT');
      assert.equal(cleanup.path, 'owned-links');
    });
  });
});

describe('standard errors across the process boundary', () => {
  ['default', 'cjs'].forEach((route) => {
    ['return', 'throw', 'callback', 'promise'].forEach((outcome) => {
      ['aggregate', 'cause', 'undefined', 'absent'].forEach((kind) => {
        it(`preserves ${kind} through ${outcome} on the ${route} worker`, () => {
          const child = process.env.ERROR_TRANSPORT_EXEC_PATH || process.execPath;
          const execPath = route === 'default' ? child : `${path.dirname(child) + path.sep}.${path.sep}${path.basename(child)}`;
          let result: unknown;
          let threw = false;
          try {
            result = call({ callbacks: outcome === 'callback', execPath }, path.join(DATA, 'standardError.cjs'), kind, outcome);
          } catch (error) {
            threw = true;
            result = error;
          }
          assert.strictEqual(threw, outcome !== 'return', 'adapter failure classification must be preserved');
          if (outcome === 'return') result = (result as { error: Error }).error;
          assert.ok(result instanceof Error);
          const error = result as Error & { cause?: Error & { cause: Error & Record<string, unknown> }; errors: (Error & { errors: unknown[] })[]; pid: number; version: string; worker: string; nativeAggregate: boolean; nativeCause: boolean };
          assert.strictEqual(error.message, 'outer');
          assert.strictEqual(error.stack, 'outer stack');
          assert.notEqual(error.pid, process.pid);
          assert.ok(/^v\d+\./.test(error.version));
          const version = error.version.slice(1).split('.').map(Number);
          assert.strictEqual(error.nativeAggregate, version[0] >= 15);
          assert.strictEqual(error.nativeCause, version[0] > 16 || (version[0] === 16 && version[1] >= 9));
          if (process.env.ERROR_TRANSPORT_CHILD_VERSION) assert.strictEqual(error.version, process.env.ERROR_TRANSPORT_CHILD_VERSION);
          assert.strictEqual(path.basename(error.worker), child === process.execPath && route === 'default' && canLoadESM ? 'runFunction.mjs' : 'runFunction.cjs');
          assert.strictEqual(Object.getOwnPropertyDescriptor(error, 'cause') !== undefined, kind !== 'absent');
          if (kind === 'absent') return;
          assert.strictEqual(Object.getOwnPropertyDescriptor(error, 'cause')?.enumerable, false);
          if (kind === 'undefined') {
            assert.strictEqual(error.cause, undefined);
            return;
          }
          assert.ok(error.cause instanceof Error);
          assert.strictEqual(error.cause?.message, 'cause');
          assert.strictEqual(error.cause?.stack, 'cause stack');
          assert.strictEqual(Object.getOwnPropertyDescriptor(error.cause as Error, 'cause')?.enumerable, false);
          const leaf = error.cause?.cause;
          assert.ok(leaf instanceof Error);
          assert.strictEqual(leaf?.message, 'leaf');
          assert.strictEqual(leaf?.stack, 'leaf stack');
          assert.strictEqual(leaf?.code, 'E_OPERATION');
          assert.strictEqual(leaf?.path, 'owned-file');
          assert.strictEqual(leaf?.status, 17);
          assert.strictEqual(leaf?.stderr, 'diagnostic output');
          if (kind !== 'aggregate') return;
          assert.strictEqual(error.name, 'AggregateError');
          if (typeof AggregateError === 'function') assert.ok(error instanceof AggregateError);
          else assert.strictEqual(Object.getPrototypeOf(error), Error.prototype);
          assert.strictEqual(Object.getOwnPropertyDescriptor(error, 'errors')?.enumerable, false);
          assert.strictEqual(error.errors.length, 2);
          assert.strictEqual(error.errors[1], 42);
          const inner = error.errors[0];
          assert.ok(inner instanceof Error);
          if (typeof AggregateError === 'function') assert.ok(inner instanceof AggregateError);
          assert.strictEqual(inner.name, 'AggregateError');
          assert.strictEqual(inner.message, 'inner');
          assert.strictEqual(inner.stack, 'inner stack');
          assert.strictEqual(Object.getOwnPropertyDescriptor(inner, 'errors')?.enumerable, false);
          assert.ok(inner.errors[0] instanceof Error);
          assert.strictEqual((inner.errors[0] as Error).message, 'leaf');
          assert.deepEqual(inner.errors.slice(1), ['ordinary', null, undefined]);
        });
      });
    });
  });
});
