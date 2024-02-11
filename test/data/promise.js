if (typeof Promise === 'undefined') global.Promise = require('pinkie-promise');

module.exports = (value) => Promise.resolve(value);
