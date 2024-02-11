if (typeof Promise === 'undefined') global.Promise = require('pinkie-promise');

module.exports = () => Promise.reject(new Error('boom'));
