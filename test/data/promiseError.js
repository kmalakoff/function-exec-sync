if (typeof Promise === 'undefined') {
  require('core-js/actual/promise');
}

module.exports = function () {
  return Promise.reject(new Error('boom'));
};
