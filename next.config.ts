import type { NextConfig } from 'next';

process.env.NEXT_TELEMETRY_DISABLED = '1';

const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@electric-sql/pglite'],
  distDir: process.env.AZUSA_NEXT_DIST_DIR || '.next',
};

export default config;
