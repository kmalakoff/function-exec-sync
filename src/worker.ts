require('./polyfills');
const fs = require('fs');
const serialize = require('serialize-javascript');
const compat = require('async-compat');

const input = process.argv[2];
const output = process.argv[3];

function writeResult(result) {
  fs.writeFile(output, serialize(result), 'utf8', () => {
    process.exit(0);
  });
}

function writeError(error) {
  const result = { error: { message: error.message, stack: error.stack } };
  for (const key in error) result.error[key] = error[key];
  writeResult(result);
}

// get data
try {
  const workerData = eval(`(${fs.readFileSync(input, 'utf8')})`);

  // set up env
  if (process.cwd() !== workerData.cwd) process.chdir(workerData.cwd);
  for (const key in workerData.env) process.env[key] = workerData.env[key];

  // call function
  const fn = require(workerData.filePath);
  if (typeof fn !== 'function') {
    writeResult({ value: fn });
  } else {
    const args = [fn, workerData.callbacks].concat(workerData.args);
    args.push((err, value) => {
      err ? writeError(err) : writeResult({ value });
    });
    compat.asyncFunction.apply(null, args);
  }
} catch (err) {
  writeError(err);
}
