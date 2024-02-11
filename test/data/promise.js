if (typeof Promise === 'undefined') global.Promise = require('pinkie-promise');

module.exports = function (value) {
  return Promise.resolve(value);
};
