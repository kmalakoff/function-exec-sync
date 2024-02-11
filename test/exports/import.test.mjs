import assert from 'assert';
import call from 'function-exec-sync';

describe('exports .mjs', () => {
  it('defaults', () => {
    assert.equal(typeof call, 'function');
  });
});
