export default function esmCallback(value, callback) {
  callback(null, `esm-callback-${value}`);
}
