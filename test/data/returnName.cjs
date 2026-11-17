var path = require('path');

module.exports = function () {
  return path.basename(path.dirname(process.argv[2]));
};
