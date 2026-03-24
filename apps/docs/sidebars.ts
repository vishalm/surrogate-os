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
      label: "Architecture",
      collapsed: false,
      items: [
        "architecture/overview",
        "architecture/multi-tenancy",
      ],
      link: {
        type: "generated-index",
        title: "Architecture",
        description:
          "Platform architecture, multi-tenancy, and system design.",
        slug: "/architecture",
      },
    },
    {
      type: "category",
      label: "API Reference",
      collapsed: false,
      items: [
        "api/endpoints",
      ],
      link: {
        type: "generated-index",
        title: "API Reference",
        description:
          "Complete REST API documentation for all 21 route modules.",
        slug: "/api",
      },
    },
    {
      type: "category",
      label: "Features",
      collapsed: false,
      items: [
        "features/phase1-studio",
        "features/phase2-persona",
        "features/phase3-fleet",
        "features/phase4-bridge",
      ],
      link: {
        type: "generated-index",
        title: "Features",
        description:
          "Platform capabilities across four development phases.",
        slug: "/features",
      },
    },
    {
      type: "category",
      label: "Vision & Philosophy",
      collapsed: true,
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
      label: "Technical Deep Dives",
      collapsed: true,
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
        title: "Technical Deep Dives",
        description:
          "Deep-dive into the Identity Core, SOP Engine, Audit Fabric, and safety architecture.",
        slug: "/technical",
      },
    },
    {
      type: "category",
      label: "Strategy & Business",
      collapsed: true,
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
