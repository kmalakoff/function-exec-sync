const fs = require('fs');

export default function unlinkSafe(filename) {
  try {
    fs.unlinkSync(filename);
  } catch {
    // skip
  }
}
