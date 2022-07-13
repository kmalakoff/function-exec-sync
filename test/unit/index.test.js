const assert = require('assert');

const call = require('function-exec-sync');
const keys = require('lodash.keys');

const path = require('path');
const DATA = path.resolve(__dirname, '..', 'data');

describe('function-exec-sync', function () {
  describe('test cases', function () {
    it('callback', function (done) {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'callback.js');
      call({callbacks: true}, fnPath, 101, function(err, result) {
        assert.ok(!err);
        assert.equal(result, 101);
        done();
      });
    });

    it('callback error', function (done) {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'callbackError.js');
      call({callbacks: true}, fnPath, 101, function(err, result) {
        assert.ok(err);
        assert.equal(err.message, 'boom');
        assert.equal(result, undefined);
        done();
      });
    });

    it('no export', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'noExport.js');
      const result = call({}, fnPath);
      assert.equal(keys(result).length, 0);
    });

    it('process result', function () {
      this.timeout(5000);
      const fnPath = path.join(DATA, 'processVersion.js');
      const result = call({}, fnPath);
      assert.equal(result, process.version);
    });

    it('return arguments', function () {
      this.timeout(20000);
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
      const fnPath = path.join(DATA, 'returnArguments.js');
      const result = call({}, fnPath, ...args);
      assert.equal(JSON.stringify(result), JSON.stringify(args));
    });

    it('throw error', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'throwError.js');
      try {
        call({}, fnPath);
        assert.ok(false);
      } catch (err) {
        assert.equal(err.message, 'boom');
      }
    });
  });

  describe('options', function () {
    it('return cwd', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'returnCwd.js');
      const result = call({ cwd: path.dirname(__dirname) }, fnPath);
      assert.equal(result, path.dirname(__dirname));
    });

    it('return env', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'returnEnv.js');
      const result = call({ env: { hello: 'there' } }, fnPath);
      assert.equal(result.hello, 'there');
    });

    it('return name', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'returnName.js');
      const result = call({ name: 'bob' }, fnPath);
      assert.equal(result, 'bob');
    });

    it('long sleep', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'returnCwd.js');
      const result = call({ cwd: path.dirname(__dirname), sleep: 10 }, fnPath);
      assert.equal(result, path.dirname(__dirname));
    });

    it('execPath', function () {
      this.timeout(20000);
      const fnPath = path.join(DATA, 'returnCwd.js');
      try {
        call({ execPath: 'hsadjhadkjhsda' }, fnPath);
        assert.ok(false);
      } catch (err) {
        assert.ok(err);
      }
    });
  });
});
