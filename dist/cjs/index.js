"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
module.exports = functionExecSync;
function functionExecSync(options, filePath /* arguments */ ) {
    var args = Array.prototype.slice.call(arguments, 2);
    var _env, _cwd;
    var workerData = {
        filePath: filePath,
        args: args,
        callbacks: options.callbacks || false,
        env: (_env = options.env) !== null && _env !== void 0 ? _env : process.env,
        cwd: (_cwd = options.cwd) !== null && _cwd !== void 0 ? _cwd : process.cwd()
    };
    var _name;
    var name = (_name = options.name) !== null && _name !== void 0 ? _name : "exec-worker-sync";
    var temp = path.join(tmpdir(), name, shortHash(workerData.cwd));
    var input = path.join(temp, suffix("input"));
    var output = path.join(temp, suffix("output"));
    // store data to a file
    mkdirp.sync(path.dirname(input));
    fs.writeFileSync(input, serialize(workerData), "utf8");
    unlinkSafe(output);
    // call the function
    var execPath = options.execPath || process.execPath;
    var worker = path.join(__dirname, "worker.js");
    // only node
    if (ALLOWED_EXEC_PATH.indexOf(path.basename(execPath).toLowerCase()) < 0) throw new Error("Expecting node executable. Received: ".concat(path.basename(execPath)));
    // use polling
    if (!cp.execFileSync) {
        // make sure the file exists
        if (execPath !== process.execPath) require("fs-access-sync-compat")(execPath);
        var _sleep;
        // exec and start polling
        var sleepMS = (_sleep = options.sleep) !== null && _sleep !== void 0 ? _sleep : DEFAULT_SLEEP_MS;
        cp.exec('"'.concat(execPath, '" "').concat(worker, '" "').concat(input, '" "').concat(output, '"'));
        while(!fs.existsSync(output)){
            sleep(sleepMS);
        }
    } else {
        cp.execFileSync(execPath, [
            worker,
            input,
            output
        ]);
    }
    // get data and clean up
    var res = eval("(".concat(fs.readFileSync(output, "utf8"), ")"));
    unlinkSafe(input);
    unlinkSafe(output);
    // throw error from the worker
    if (res.error) {
        var err = new Error(res.error.message);
        if (res.error.stack) err.stack = res.error.stack;
        throw err;
    }
    // return the result
    return res.value;
}
require("./polyfills.js");
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var tmpdir = require("os").tmpdir || require("os-shim").tmpdir;
var suffix = require("temp-suffix");
var serialize = require("serialize-javascript");
var mkdirp = require("mkdirp");
var shortHash = require("short-hash");
var sleep = require("thread-sleep-compat");
var DEFAULT_SLEEP_MS = 100;
var ALLOWED_EXEC_PATH = [
    "node",
    "node.exe",
    "node.cmd"
];
// @ts-ignore
var unlinkSafe = require("./unlinkSafe.js");
