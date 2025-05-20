import assert from 'assert';

// @ts-ignore
import call from 'function-exec-sync';

describe('exports .ts', () => {
  it('defaults', () => {
    assert.equal(typeof call, 'function');
  });
});
