const Pinkie = require('pinkie-promise');
const assert = require('assert');

const call = require('function-exec-sync');
const keys = require('lodash.keys');

const path = require('path');
const DATA = path.join(__dirname, '..', 'data');

describe('function-exec-sync', () => {
  describe('test cases', () => {
    (() => {
      // patch and restore promise
      // @ts-ignore
      let rootPromise;
      before(() => {
        rootPromise = global.Promise;
        global.Promise = Pinkie;
      });
      after(() => {
        global.Promise = rootPromise;
      });
    })();

    it('callback', () => {
      const fnPath = path.join(DATA, 'callback');
      const result = call({ callbacks: true }, fnPath, 101);
      assert.equal(result, 101);
    });

    it('callback error', () => {
      const fnPath = path.join(DATA, 'callbackError');
      try {
        call({ callbacks: true }, fnPath, 101);
        assert.ok(false);
      } catch (err) {
        assert.equal(err.message, 'boom');
        assert.equal(err.custom, true);
      }
    });

    it('no export', () => {
      const fnPath = path.join(DATA, 'noExport');
      const result = call(fnPath);
      assert.equal(keys(result).length, 0);
    });

    it('process result', () => {
      const fnPath = path.join(DATA, 'processVersion');
      const result = call(fnPath);
      assert.equal(result, process.version);
    });

    it('promise', () => {
      const fnPath = path.join(DATA, 'promise');
      const result = call(fnPath, 101);
      assert.equal(result, 101);
    });

    it('promise error', () => {
      const fnPath = path.join(DATA, 'promiseError');
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
        new URL('https://hello.com'),
        new Map(),
        new Set(),
      ];
      const fnPath = path.join(DATA, 'returnArguments');
      const result = call(fnPath, ...args);
      assert.equal(JSON.stringify(result), JSON.stringify(args));
    });

    it('throw error', () => {
      const fnPath = path.join(DATA, 'throwError');
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
      const fnPath = path.join(DATA, 'returnCwd');
      const result = call({ cwd: path.dirname(__dirname) }, fnPath);
      assert.equal(result, path.dirname(__dirname));
    });

    it('return env', () => {
      const fnPath = path.join(DATA, 'returnEnv');
      const result = call({ env: { hello: 'there' } }, fnPath);
      assert.equal(result.hello, 'there');
    });

    it('return name', () => {
      const fnPath = path.join(DATA, 'returnName');
      const result = call({ name: 'bob' }, fnPath);
      assert.equal(result, 'bob');
    });

    it('long sleep', () => {
      const fnPath = path.join(DATA, 'returnCwd');
      const result = call({ cwd: path.dirname(__dirname), sleep: 10 }, fnPath);
      assert.equal(result, path.dirname(__dirname));
    });

    it('execPath invalid format', () => {
      const fnPath = path.join(DATA, 'returnCwd');
      try {
        call({ execPath: 'hsadjhadkjhsda' }, fnPath);
        assert.ok(false);
      } catch (err) {
        assert.ok(err);
      }
    });

    it('execPath fake path', () => {
      const fnPath = path.join(DATA, 'returnCwd');
      try {
        call({ execPath: '/fake/path/node' }, fnPath);
        assert.ok(false);
      } catch (err) {
        assert.ok(err);
      }
    });
  });
});
