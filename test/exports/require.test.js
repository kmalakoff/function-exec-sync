const assert = require('assert');
const call = require('function-exec-sync');

describe('exports .cjs', function () {
  it('defaults', function () {
    assert.equal(typeof call, 'function');
  });
});
