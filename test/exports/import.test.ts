const assert = require('assert');
const call = require('function-exec-sync');

describe('exports .ts', () => {
  it('defaults', () => {
    assert.equal(typeof call, 'function');
  });
});
