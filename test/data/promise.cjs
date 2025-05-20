const Pinkie = require('pinkie-promise');

module.exports = function (value) {
  return Pinkie.resolve(value);
};
