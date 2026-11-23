import { getDbContext, closeDbContext } from '../../src/persistence/client';
async function main() {
  try {
    const ctx = await getDbContext({
      processType: 'cli:migrate',
      onCompromised: (error) => {
        console.error(
          JSON.stringify({
            ok: false,
            stage: 'init',
            message: error.message,
            recoveryHint: 'Lock lost; stop other database processes and retry.',
          }),
        );
        process.exitCode = 1;
      },
    });
    console.log(JSON.stringify({ ok: true, dbDir: ctx.dbDir }));
  } catch (e) {
    const err = e as {
      stage?: string;
      message?: string;
      recoveryHint?: string;
    };
    console.error(
      JSON.stringify({
        ok: false,
        stage: err.stage ?? 'init',
        message: err.message,
        recoveryHint: err.recoveryHint,
      }),
    );
    process.exitCode = 1;
  } finally {
    await closeDbContext();
  }
}
void main();
