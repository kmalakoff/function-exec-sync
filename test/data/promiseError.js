const Pinkie = require('pinkie-promise');

module.exports = function () {
  return Pinkie.reject(new Error('boom'));
};
