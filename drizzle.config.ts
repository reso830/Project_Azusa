import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/persistence/schema/index.ts',
  out: './src/persistence/migrations',
  dialect: 'postgresql',
});
