require('core-js/actual/array/from');
require('core-js/actual/map');
require('core-js/actual/set');
if (!global.URL) global.URL = require('core-js/web/url');
// @ts-ignore
if (!global.BigInt) global.BigInt = (v) => v; // not supported
