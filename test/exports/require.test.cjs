const assert = require('assert');
const call = require('function-exec-sync');

describe('exports .cjs', () => {
  it('defaults', () => {
    assert.equal(typeof call, 'function');
  });
});
