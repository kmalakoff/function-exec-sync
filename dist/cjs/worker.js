"use strict";
require("./polyfills");
var fs = require("fs");
var serialize = require("serialize-javascript");
var input = process.argv[2];
var output = process.argv[3];
function writeResult(result) {
    fs.writeFile(output + ".tmp", serialize(result), "utf8", function() {
        fs.rename(output + ".tmp", output, function() {
            process.exit(0);
        });
    });
}
// get data
try {
    var workerData = eval("(".concat(fs.readFileSync(input, "utf8"), ")"));
    // set up env
    if (process.cwd() !== workerData.cwd) process.chdir(workerData.cwd);
    for(var key in workerData.env){
        if (process.env[key] === undefined) process.env[key] = workerData.env[key];
    }
    // call function
    var fn = require(workerData.filePath);
    var value = typeof fn == "function" ? fn.apply(null, workerData.args) : undefined;
    writeResult({
        value: value
    });
} catch (err) {
    writeResult({
        error: {
            message: err.message,
            stack: err.stack
        }
    });
}
