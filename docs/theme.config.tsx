/**
 * Nextra theme configuration for tship documentation.
 */
import type { DocsThemeConfig } from 'nextra-theme-docs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');

const config: DocsThemeConfig = {
  logo: <strong>{pkg.name}</strong>,
  project: {
    link: 'https://github.com/jstility/tship',
  },
  docsRepositoryBase: 'https://github.com/jstility/tship/tree/main/docs',
  footer: {
    text: `Copyright © ${new Date().getFullYear()} JStility`,
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – tship',
      description: pkg.description,
    };
  },
  head: (
    <>
      <link rel="icon" href="https://raw.githubusercontent.com/jstility/.github/refs/heads/master/image/favicon.svg" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
  },
  toc: {
    backToTop: true,
  },
  navigation: {
    prev: true,
    next: true,
  },
};

export default config;
