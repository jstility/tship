import nextra from 'nextra';
import type { NextConfig } from 'next';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  staticImage: true,
  defaultShowCopyCode: true,
});

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/tship',
  assetPrefix: '/tship/',
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default withNextra(nextConfig);
