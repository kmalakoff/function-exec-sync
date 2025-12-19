import fs from 'fs';

export default function unlinkSafe(filename: string): void {
  try {
    fs.unlinkSync(filename);
  } catch {
    // skip
  }
}
