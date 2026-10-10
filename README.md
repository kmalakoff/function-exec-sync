# function-exec-sync

Run an exported function in a Node.js process and return its value.

```sh
npm install function-exec-sync
```

Create `worker.cjs`:

```js
module.exports = function (name, count) {
  return Array(count + 1).join(name);
};
```

Call it from another CommonJS file:

```js
var path = require('path');
var call = require('function-exec-sync');

var result = call(path.join(__dirname, 'worker.cjs'), 'ha', 2);
console.log(result); // "haha"
```

Pass `execPath` in an options object to select a Node executable:

```js
var result = call({ execPath: '/path/to/node' }, path.join(__dirname, 'worker.cjs'), 'ha', 2);
```

The target module, arguments, and returned value cross a process boundary, so
keep them serializable by this package. Circular values are not supported.

Error values retain their names, messages, stacks, enumerable diagnostic fields,
and own `cause` and `errors` fields. AggregateError values use the receiving
runtime's native constructor when available. Older Node versions receive a local
Error retaining the aggregate data. Other Error subclass prototypes are not preserved.
A directly returned Error is treated as a failure; return an ordinary container
such as `{ error: error }` to include an Error in a successful result.

### Documentation

[API Docs](https://kmalakoff.github.io/function-exec-sync/)
