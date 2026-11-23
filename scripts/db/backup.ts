import { lockErrorMessage } from '../../src/persistence/lock';
import { createManualBackup } from '../../src/persistence/backup';

async function main() {
  try {
    const result = await createManualBackup({
      dbDir: process.env.AZUSA_DB_DIR ?? '.azusa/data/db',
      backupDir: process.env.AZUSA_BACKUP_DIR ?? '.azusa/data/backups',
    });
    console.log(
      JSON.stringify({
        ok: result.ok,
        backupId: result.backupId,
        backupPath: result.backupPath,
        filesCopied: result.filesCopied,
        createdAt: result.createdAt,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        error: lockErrorMessage(error),
      }),
    );
    process.exitCode = 1;
  }
}
void main();
