import assert from 'assert';
import call from 'function-exec-sync';

describe('exports .mjs', function () {
  it('defaults', function () {
    assert.equal(typeof call, 'function');
  });
});
