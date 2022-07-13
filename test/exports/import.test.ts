const assert = require('assert');
const call = require('function-exec-sync');

describe('exports .ts', function () {
  it('defaults', function () {
    assert.equal(typeof call, 'function');
  });
});
