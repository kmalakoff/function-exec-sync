import assert from 'assert';
import fs from 'fs';
import call from 'function-exec-sync';
import keys from 'lodash.keys';
import { supportsESM } from 'module-compat';
import path from 'path';
import Pinkie from 'pinkie-promise';
import url from 'url';
import { tmpdir } from '../lib/compat.ts';

const __dirname = path.dirname(typeof __filename === 'undefined' ? url.fileURLToPath(import.meta.url) : __filename);
const DATA = path.join(__dirname, '..', 'data');

const major = +process.versions.node.split('.')[0];
const canLoadESM = supportsESM();

describe('function-exec-sync', () => {
  describe('test cases', () => {
    (() => {
      // patch and restore promise
      if (typeof global === 'undefined') return;
      const globalPromise = global.Promise;
      before(() => {
        global.Promise = Pinkie;
      });
      after(() => {
        global.Promise = globalPromise;
      });
    })();

    it('callback', () => {
      const fnPath = path.join(DATA, 'callback.cjs');
      const result = call({ callbacks: true }, fnPath, 101);
      assert.equal(result, 101);
    });

    it('callback error', () => {
      const fnPath = path.join(DATA, 'callbackError.cjs');
      try {
        call({ callbacks: true }, fnPath, 101);
        assert.ok(false);
      } catch (err) {
        assert.equal(err.message, 'boom');
        assert.equal(err.custom, true);
      }
    });

    it('no export', () => {
      const fnPath = path.join(DATA, 'noExport.cjs');
      const result = call(fnPath);
      assert.equal(keys(result).length, 0);
    });

    it('process result', () => {
      const fnPath = path.join(DATA, 'processVersion.cjs');
      const result = call(fnPath);
      assert.equal(result, process.version);
    });

    it('promise', () => {
      const fnPath = path.join(DATA, 'promise.cjs');
      const result = call(fnPath, 101);
      assert.equal(result, 101);
    });

    it('promise error', () => {
      const fnPath = path.join(DATA, 'promiseError.cjs');
      try {
        call(fnPath, 101);
        assert.ok(false);
      } catch (err) {
        assert.equal(err.message, 'boom');
      }
    });

    it('return arguments', () => {
      const args = [
        { field2: 1 },
        1,
        function hey() {
          return null;
        },
        major > 0 ? [typeof URL === 'undefined' ? null : new URL('https://hello.com'), typeof Map === 'undefined' ? null : new Map(), typeof Set === 'undefined' ? null : new Set()] : [],
      ];
      const fnPath = path.join(DATA, 'returnArguments.cjs');
      const result = call(fnPath, ...args);
      assert.equal(JSON.stringify(result), JSON.stringify(args));
    });

    it('throw error', () => {
      const fnPath = path.join(DATA, 'throwError.cjs');
      try {
        call(fnPath);
        assert.ok(false);
      } catch (err) {
        assert.equal(err.message, 'boom');
      }
    });
  });

  describe('options', () => {
    it('return cwd', () => {
      const fnPath = path.join(DATA, 'returnCwd.cjs');
      const result = call({ cwd: path.dirname(__dirname) }, fnPath);
      assert.equal(result, path.dirname(__dirname));
    });

    it('works with different execPath (uses CJS worker)', function () {
      // This test ensures CJS worker is used when execPath !== process.execPath
      // We create a symlink to current Node to simulate a different execPath
      const tmpDir = path.join(tmpdir(), `node-test-${Date.now()}`);
      const tmpLink = path.join(tmpDir, 'node');
      try {
        fs.mkdirSync(tmpDir);
        fs.symlinkSync(process.execPath, tmpLink);
      } catch (_e) {
        // Symlinks may not work on all systems (e.g., Windows without admin)
        return this.skip();
      }
      try {
        const fnPath = path.join(DATA, 'processVersion.cjs');
        const result = call({ execPath: tmpLink }, fnPath) as string;
        assert.equal(result, process.version);
      } finally {
        try {
          fs.unlinkSync(tmpLink);
          fs.rmdirSync(tmpDir);
        } catch (_e) {
          // ignore cleanup errors
        }
      }
    });

    it('return env', () => {
      const fnPath = path.join(DATA, 'returnEnv.cjs');
      const result = call({ env: { hello: 'there' } }, fnPath);
      assert.equal(result.hello, 'there');
    });

    it('return name', () => {
      const fnPath = path.join(DATA, 'returnName.cjs');
      const result = call({ name: 'bob' }, fnPath);
      assert.equal(result, 'bob');
    });

    it('long sleep', () => {
      const fnPath = path.join(DATA, 'returnCwd.cjs');
      const result = call({ cwd: path.dirname(__dirname), sleep: 10 }, fnPath);
      assert.equal(result, path.dirname(__dirname));
    });

    it('execPath invalid format', () => {
      const fnPath = path.join(DATA, 'returnCwd.cjs');
      try {
        call({ execPath: 'hsadjhadkjhsda' }, fnPath);
        assert.ok(false);
      } catch (err) {
        assert.ok(err);
      }
    });

    it('execPath fake path', () => {
      const fnPath = path.join(DATA, 'returnCwd.cjs');
      try {
        call({ execPath: '/fake/path/node' }, fnPath);
        assert.ok(false);
      } catch (err) {
        assert.ok(err);
      }
    });
  });

  describe('ESM modules', () => {
    before(function () {
      if (!canLoadESM) this.skip();
    });

    it('loads ESM function with default export', () => {
      const fnPath = path.join(DATA, 'esm-function.mjs');
      const result = call(fnPath, 'test');
      assert.equal(result, 'esm-test');
    });

    it('loads ESM callback function', () => {
      const fnPath = path.join(DATA, 'esm-callback.mjs');
      const result = call({ callbacks: true }, fnPath, 'test');
      assert.equal(result, 'esm-callback-test');
    });

    it('loads ESM promise function', () => {
      const fnPath = path.join(DATA, 'esm-promise.mjs');
      const result = call(fnPath, 'test');
      assert.equal(result, 'esm-promise-test');
    });

    it('loads ESM with raw interop for named exports', () => {
      const fnPath = path.join(DATA, 'esm-named.mjs');
      const result = call({ interop: 'raw' }, fnPath) as Record<string, () => string>;
      assert.equal(typeof result.foo, 'function');
      assert.equal(typeof result.bar, 'function');
      assert.equal(result.foo(), 'foo-result');
      assert.equal(result.bar(), 'bar-result');
    });
  });
});
