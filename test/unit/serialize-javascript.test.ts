import assert from 'assert';
import vm from 'vm';
import serialize from '../../src/serialize-javascript.ts';

describe('Error serialization', () => {
  it('preserves an own __proto__ field as data', () => {
    const error = new Error('owned field');
    Object.defineProperty(error, '__proto__', { value: { inherited: 'must remain field data' }, enumerable: true });
    const result = vm.runInThisContext(`(${serialize(error)})`) as Error & Record<string, unknown>;
    assert.ok(result instanceof Error);
    assert.strictEqual(Object.getPrototypeOf(result), Error.prototype);
    assert.strictEqual(Object.getOwnPropertyDescriptor(result, '__proto__') !== undefined, true);
    assert.deepEqual(Object.getOwnPropertyDescriptor(result, '__proto__')?.value, { inherited: 'must remain field data' });
    assert.strictEqual(Object.getOwnPropertyDescriptor(result, 'inherited') !== undefined, false);
  });

  it('escapes nested Error text and preserves serializer options', () => {
    const message = '"quoted" </script>\u2028\u2029';
    const nested = new Error(message);
    nested.stack = message;
    const input = { errors: [nested] };
    [{ space: 2 }, { unsafe: true }].forEach((options) => {
      const expected = options.unsafe === true ? '"quoted" </script>' : message;
      const error = new Error(expected);
      error.stack = expected;
      const text = serialize({ errors: [error] }, options);
      assert.strictEqual(text.indexOf('</script>') !== -1, options.unsafe === true);
      const result = vm.runInThisContext(`(${text})`) as { errors: Error[] };
      assert.ok(result.errors[0] instanceof Error);
      assert.strictEqual(result.errors[0].message, expected);
      assert.strictEqual(result.errors[0].stack, expected);
    });
    assert.ok(serialize(input, { unsafe: true }).indexOf('\u2028') !== -1);
    assert.strictEqual(serialize(input, { isJSON: true }), JSON.stringify(input));
    const withFunction: Error & { custom?: () => void } = new Error(message);
    withFunction.custom = () => {};
    const text = serialize({ errors: [withFunction] }, { ignoreFunction: true });
    const result = vm.runInThisContext(`(${text})`) as { errors: Error[] };
    assert.ok(result.errors[0] instanceof Error);
    assert.strictEqual(result.errors[0].message, message);
    assert.strictEqual(Object.getOwnPropertyDescriptor(result.errors[0], 'custom') !== undefined, false);
  });

  it('preserves absent and own undefined standard fields', () => {
    const absent = vm.runInThisContext(`(${serialize(new Error('absent'))})`);
    const input = new Error('present');
    Object.defineProperty(input, 'cause', { value: undefined });
    Object.defineProperty(input, 'errors', { value: undefined });
    const result = vm.runInThisContext(`(${serialize(input)})`);
    ['cause', 'errors'].forEach((key) => {
      assert.strictEqual(Object.getOwnPropertyDescriptor(absent, key) !== undefined, false);
      const descriptor = Object.getOwnPropertyDescriptor(result, key);
      assert.ok(descriptor);
      assert.strictEqual(descriptor?.value, undefined);
      assert.strictEqual(descriptor?.enumerable, false);
    });
  });

  (typeof AggregateError === 'function' ? it : it.skip)('preserves native aggregate identity even with a custom name', () => {
    const input = new AggregateError([new Error('nested'), 17, null], 'aggregate');
    Object.defineProperty(input, 'cause', { value: new Error('cause') });
    input.name = 'CustomAggregate';
    const result = vm.runInThisContext(`(${serialize(input)})`);
    assert.ok(result instanceof AggregateError);
    assert.strictEqual(result.name, 'CustomAggregate');
    assert.ok(result.errors[0] instanceof Error);
    assert.strictEqual(result.errors[0].message, 'nested');
    assert.deepEqual(result.errors.slice(1), [17, null]);
    assert.ok(result.cause instanceof Error);
    assert.strictEqual(result.cause.message, 'cause');
    assert.strictEqual(Object.getOwnPropertyDescriptor(result, 'errors')?.enumerable, false);
    assert.strictEqual(Object.getOwnPropertyDescriptor(result, 'cause')?.enumerable, false);
  });

  it('reconstructs a local aggregate on receivers with or without the native constructor', () => {
    const input = new Error('local aggregate');
    input.name = 'AggregateError';
    Object.defineProperty(input, 'errors', { value: [new Error('nested')] });
    const text = serialize(input);
    const native = vm.runInThisContext(`(${text})`) as Error & { errors: Error[] };
    assert.ok(native instanceof Error);
    if (typeof AggregateError === 'function') assert.ok(native instanceof AggregateError);
    assert.strictEqual(native.errors[0].message, 'nested');
    assert.strictEqual(Object.getOwnPropertyDescriptor(native, 'errors')?.enumerable, false);
    if (typeof AggregateError !== 'function') assert.strictEqual(Object.getPrototypeOf(native), Error.prototype);
  });

  it('preserves ordinary cause values', () => {
    [null, false, 0, 'ordinary', { detail: true }, [1, 2]].forEach((cause) => {
      const input = new Error('ordinary cause');
      Object.defineProperty(input, 'cause', { value: cause });
      const result = vm.runInThisContext(`(${serialize(input)})`);
      assert.deepEqual(result.cause, cause);
      assert.strictEqual(Object.getOwnPropertyDescriptor(result, 'cause')?.enumerable, false);
    });
  });

  it('rejects cyclic Error fields like cyclic object data', () => {
    const error: Error & { custom?: unknown } = new Error('cycle');
    error.custom = { error };
    assert.throws(() => serialize(error), TypeError);
    const cause = new Error('cause cycle');
    Object.defineProperty(cause, 'cause', { value: cause });
    assert.throws(() => serialize(cause), TypeError);
    const aggregate = new Error('aggregate cycle');
    Object.defineProperty(aggregate, 'errors', { value: [aggregate] });
    assert.throws(() => serialize(aggregate), TypeError);
    const object: { self?: unknown } = {};
    object.self = object;
    assert.throws(() => serialize(object), TypeError);
  });
});
