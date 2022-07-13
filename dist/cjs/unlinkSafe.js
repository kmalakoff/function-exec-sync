"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
module.exports = unlinkSafe;
function unlinkSafe(filename) {
    try {
        fs.unlinkSync(filename);
    } catch (e) {
    // skip
    }
}
var fs = require("fs");
