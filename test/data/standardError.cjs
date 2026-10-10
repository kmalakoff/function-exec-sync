module.exports = function (kind, outcome, callback) {
  var hasCause = Object.prototype.hasOwnProperty.call(new Error('', { cause: undefined }), 'cause');
  var leaf = new Error('leaf');
  leaf.stack = 'leaf stack';
  leaf.code = 'E_OPERATION';
  leaf.path = 'owned-file';
  leaf.status = 17;
  leaf.stderr = 'diagnostic output';
  var cause = hasCause ? new Error('cause', { cause: leaf }) : new Error('cause');
  if (!hasCause) Object.defineProperty(cause, 'cause', { value: leaf });
  cause.stack = 'cause stack';
  var inner = typeof AggregateError === 'function' ? new AggregateError([leaf, 'ordinary', null, undefined], 'inner') : new Error('inner');
  inner.name = 'AggregateError';
  if (typeof AggregateError !== 'function') Object.defineProperty(inner, 'errors', { value: [leaf, 'ordinary', null, undefined] });
  inner.stack = 'inner stack';
  var error;
  if (kind === 'aggregate') {
    error = typeof AggregateError === 'function' ? new AggregateError([inner, 42], 'outer', { cause: cause }) : new Error('outer');
    error.name = 'AggregateError';
    if (typeof AggregateError !== 'function') Object.defineProperty(error, 'errors', { value: [inner, 42] });
  } else {
    error = hasCause ? new Error('outer', { cause: kind === 'undefined' ? undefined : cause }) : new Error('outer');
  }
  if (!Object.prototype.hasOwnProperty.call(error, 'cause') && kind !== 'absent') Object.defineProperty(error, 'cause', { value: kind === 'undefined' ? undefined : cause });
  if (kind === 'absent') delete error.cause;
  error.stack = 'outer stack';
  error.pid = process.pid;
  error.version = process.version;
  error.worker = process.argv[1];
  error.nativeAggregate = typeof AggregateError === 'function';
  error.nativeCause = hasCause;
  if (outcome === 'throw') throw error;
  if (outcome === 'callback') return callback(error);
  if (outcome === 'promise') return (typeof Promise === 'function' ? Promise : require('pinkie-promise')).reject(error);
  return { error: error };
};
