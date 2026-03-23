import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Surrogate OS",
  tagline: "The AI Identity Engine That Becomes the Employee",
  favicon: "img/favicon.ico",

  url: "https://docs.surrogate-os.com",
  baseUrl: "/",

  organizationName: "surrogate-os",
  projectName: "surrogate-os",

  onBrokenLinks: "throw",

  markdown: {
    mermaid: true,
  },
  themes: ["@docusaurus/theme-mermaid"],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/vishalm/surrogate-os/tree/main/apps/docs/",
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/surrogate-os-social.png",
    metadata: [
      {
        name: "keywords",
        content:
          "AI, professional identity, SOP, surrogate, healthcare AI, humanoid, enterprise AI",
      },
      {
        name: "description",
        content:
          "Surrogate OS synthesizes complete professional identities and deploys them as operational AI agents across chat, voice, avatar, and humanoid interfaces.",
      },
    ],
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: "alpha",
      content:
        '🚀 Surrogate OS is in active development — <a href="/docs/getting-started/overview">get started</a> or read the <a href="/docs/vision/thesis">vision</a>',
      backgroundColor: "#4f46e5",
      textColor: "#ffffff",
      isCloseable: true,
    },
    navbar: {
      title: "Surrogate OS",
      logo: {
        alt: "Surrogate OS Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          to: "/docs/vision/thesis",
          label: "Vision",
          position: "left",
        },
        {
          to: "/docs/technical/architecture",
          label: "Architecture",
          position: "left",
        },
        {
          to: "/docs/strategy/market",
          label: "Strategy",
          position: "left",
        },
        {
          href: "https://github.com/vishalm/surrogate-os",
          label: "GitHub",
          position: "right",
        },
        {
          href: "mailto:hello@surrogate-os.com",
          label: "Contact",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Platform",
          items: [
            { label: "Getting Started", to: "/docs/getting-started/overview" },
            { label: "Architecture", to: "/docs/technical/architecture" },
            { label: "API Reference", to: "/docs/technical/api-reference" },
            { label: "Safety", to: "/docs/technical/safety" },
          ],
        },
        {
          title: "Vision",
          items: [
            { label: "Central Thesis", to: "/docs/vision/thesis" },
            { label: "Seed Thought", to: "/docs/vision/seed-thought" },
            { label: "The Future", to: "/docs/vision/future" },
          ],
        },
        {
          title: "Strategy",
          items: [
            { label: "Market Opportunity", to: "/docs/strategy/market" },
            { label: "Defensibility", to: "/docs/strategy/moat" },
            { label: "Go-To-Market", to: "/docs/strategy/gtm" },
            { label: "Risk Register", to: "/docs/strategy/risk" },
          ],
        },
        {
          title: "Connect",
          items: [
            { label: "GitHub", href: "https://github.com/vishalm/surrogate-os" },
            { label: "Email", href: "mailto:hello@surrogate-os.com" },
            { label: "Build With Us", href: "mailto:build@surrogate-os.com" },
            {
              label: "Research",
              href: "mailto:research@surrogate-os.com",
            },
          ],
        },
      ],
      copyright: `"The workforce is a right, not a privilege." — Surrogate OS ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: [
        "bash",
        "json",
        "typescript",
        "python",
        "http",
      ],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
    mermaid: {
      theme: { light: "default", dark: "dark" },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
