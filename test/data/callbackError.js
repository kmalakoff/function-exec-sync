module.exports = function (_value, cb) {
  var error = new Error('boom');
  error.custom = true;
  cb(error);
};
