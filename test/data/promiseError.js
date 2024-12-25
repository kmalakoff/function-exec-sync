const Promise = require('pinkie-promise');

module.exports = function () {
  return Promise.reject(new Error('boom'));
};
