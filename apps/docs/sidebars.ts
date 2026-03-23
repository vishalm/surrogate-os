import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: [
        "getting-started/overview",
        "getting-started/quick-start",
        "getting-started/configuration",
      ],
      link: {
        type: "generated-index",
        title: "Getting Started",
        description:
          "Everything you need to get up and running with Surrogate OS.",
        slug: "/getting-started",
      },
    },
    {
      type: "category",
      label: "Vision & Philosophy",
      collapsed: false,
      items: [
        "vision/thesis",
        "vision/seed-thought",
        "vision/future",
      ],
      link: {
        type: "generated-index",
        title: "Vision & Philosophy",
        description:
          "The founding insight, central thesis, and long-horizon vision for Surrogate OS.",
        slug: "/vision",
      },
    },
    {
      type: "category",
      label: "Technical Architecture",
      collapsed: false,
      items: [
        "technical/architecture",
        "technical/identity-core",
        "technical/sop-engine",
        "technical/audit-fabric",
        "technical/api-reference",
        "technical/safety",
      ],
      link: {
        type: "generated-index",
        title: "Technical Architecture",
        description:
          "Deep-dive into the Identity Core, SOP Engine, Audit Fabric, and safety architecture.",
        slug: "/technical",
      },
    },
    {
      type: "category",
      label: "Strategy & Business",
      collapsed: false,
      items: [
        "strategy/market",
        "strategy/moat",
        "strategy/gtm",
        "strategy/risk",
        "strategy/why-build",
      ],
      link: {
        type: "generated-index",
        title: "Strategy & Business",
        description:
          "Market analysis, defensibility architecture, go-to-market, and risk register.",
        slug: "/strategy",
      },
    },
  ],
};

export default sidebars;
