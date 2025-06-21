import fs from 'fs';

export default function unlinkSafe(filename: string): undefined {
  try {
    fs.unlinkSync(filename);
  } catch {
    // skip
  }
}
