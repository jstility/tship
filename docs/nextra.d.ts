declare module 'nextra' {
  import type { NextConfig } from 'next';
  function nextra(opts?: Record<string, unknown>): (config: NextConfig) => NextConfig;
  export default nextra;
}
