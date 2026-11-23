import { lockErrorMessage } from '../../src/persistence/lock';
import { restoreBackup } from '../../src/persistence/backup';

async function main() {
  try {
    const args = process.argv.slice(2);
    let from: string | undefined,
      to: string | undefined,
      forceOverwriteActive = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--from' || arg === '--to') {
        const value = args[++i];
        if (!value || value.startsWith('--'))
          throw new Error(`${arg} requires a value`);
        if (arg === '--from') from = value;
        else to = value;
      } else if (arg === '--force-overwrite-active')
        forceOverwriteActive = true;
      else throw new Error(`Unknown argument: ${arg}`);
    }
    if (!from) throw new Error('--from is required');
    const result = await restoreBackup({
      from,
      to,
      forceOverwriteActive,
      activeDbDir: process.env.AZUSA_DB_DIR ?? '.azusa/data/db',
      backupDir: process.env.AZUSA_BACKUP_DIR ?? '.azusa/data/backups',
    });
    console.log(JSON.stringify(result));
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
