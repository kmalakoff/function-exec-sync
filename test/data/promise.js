if (typeof Promise === 'undefined') {
  require('core-js/actual/promise');
}

module.exports = function (value) {
  return Promise.resolve(value);
};
