module.exports = function (values, cb) {
  var operation = new Error(values.operation);
  operation.name = 'OperationFailure';
  operation.stack = values.operationStack;
  operation.status = 17;
  operation.stderr = values.operation;
  operation.details = { error: new Error(values.inner) };
  operation.details.error.stack = values.innerStack;
  var cleanup = new Error(values.cleanup);
  cleanup.name = 'CleanupFailure';
  cleanup.stack = values.cleanupStack;
  cleanup.code = 'ENOENT';
  cleanup.path = 'owned-links';
  var error = new Error('operation and cleanup failed');
  error.errors = [operation, cleanup];
  error.worker = process.argv[1];
  error.pid = process.pid;
  cb(error);
};
