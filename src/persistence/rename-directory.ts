import { rename } from 'node:fs/promises';
import { platform } from 'node:process';

export async function renameDirectory(
  from: string,
  to: string,
  check: () => void = () => {},
) {
  for (let attempt = 0; ; attempt++) {
    check();
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows scanners and directory watchers can briefly deny a rename.
      if (
        platform !== 'win32' ||
        !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '') ||
        attempt >= 4
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}
