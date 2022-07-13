require('./polyfills');
const fs = require('fs');
const serialize = require('serialize-javascript');

const input = process.argv[2];
const output = process.argv[3];

function writeResult(result) {
  fs.writeFile(output + '.tmp', serialize(result), 'utf8', function () {
    fs.rename(output + '.tmp', output, function () {
      process.exit(0);
    });
  });
}

// get data
try {
  const workerData = eval(`(${fs.readFileSync(input, 'utf8')})`);

  // set up env
  if (process.cwd() !== workerData.cwd) process.chdir(workerData.cwd);
  for (const key in workerData.env) {
    if (process.env[key] === undefined) process.env[key] = workerData.env[key];
  }

  // call function
  const fn = require(workerData.filePath);
  const value = typeof fn == 'function' ? fn.apply(null, workerData.args) : fn;
  writeResult({ value });
} catch (err) {
  writeResult({ error: { message: err.message, stack: err.stack } });
}
