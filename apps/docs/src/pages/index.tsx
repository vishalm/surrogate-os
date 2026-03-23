import { useEffect, useRef } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useColorMode } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import mermaid from "mermaid";

// ── SVG Icon components (stroke-based, 24x24) ──────────────────────────
const IconBrain = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const IconClipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
  </svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
  </svg>
);

const IconServer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z" />
  </svg>
);

const IconCpu = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
  </svg>
);

const IconChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);

// ── Data ─────────────────────────────────────────────────────────────────

const STATS = [
  { number: "$54T", label: "Global Professional Services" },
  { number: "290M", label: "People Lacking Healthcare" },
  { number: "147", label: "Auto-Generated SOPs per Role" },
  { number: "6", label: "Compound Moats" },
];

const FEATURES = [
  {
    Icon: IconBrain,
    title: "Identity Engine",
    description:
      "Give it a role. It synthesizes a complete professional identity — knowledge, SOPs, behavioral model, compliance layer — and deploys it as an operational AI agent.",
    link: "/docs/technical/identity-core",
  },
  {
    Icon: IconClipboard,
    title: "SOP Auto-Generation",
    description:
      "Automatically generates structured, version-controlled SOPs from regulatory standards. Not documents — executable operational graphs the system actively traverses.",
    link: "/docs/technical/sop-engine",
  },
  {
    Icon: IconShield,
    title: "Immutable Audit Trail",
    description:
      "Blockchain-style cryptographically-signed audit chain. Every decision logged with rationale, confidence, and authorization chain. Tamper-proof by architecture.",
    link: "/docs/technical/audit-fabric",
  },
  {
    Icon: IconServer,
    title: "Multi-Tenant Platform",
    description:
      "Schema-based tenant isolation, BYOK encryption, per-org vector DB namespaces. Designed for NHS, FCA, and HIPAA compliance from day one.",
    link: "/docs/technical/architecture",
  },
  {
    Icon: IconCpu,
    title: "Humanoid Bridge",
    description:
      "The same identity that runs a chat interface runs in a humanoid robot. Task Translation Engine converts cognitive decisions to physical actions with multi-level safety.",
    link: "/docs/vision/thesis",
  },
  {
    Icon: IconChart,
    title: "Full Observability",
    description:
      "OpenTelemetry tracing, Prometheus metrics, Loki logs, Grafana dashboards. Distributed tracing across every SOP traversal and audit decision.",
    link: "/docs/technical/architecture",
  },
];

const PHASES = [
  { phase: "Phase 1", title: "Surrogate Studio", time: "Now — 6 months", status: "In Progress" },
  { phase: "Phase 2", title: "Living Persona Layer", time: "6 — 12 months", status: "Planned" },
  { phase: "Phase 3", title: "Fleet Intelligence", time: "12 — 18 months", status: "Planned" },
  { phase: "Phase 4", title: "Humanoid Bridge", time: "18 — 30 months", status: "Planned" },
  { phase: "Phase 5", title: "Surrogate Civilization", time: "30 — 60 months", status: "Vision" },
];

// ── Sections ─────────────────────────────────────────────────────────────

function HeroBanner() {
  return (
    <header className="hero-banner glow-bg">
      <div className="container">
        <span className="badge--alpha">v2.0-alpha &middot; Active Development</span>
        <Heading as="h1" className="hero__title" style={{ marginTop: "1.5rem" }}>
          Surrogate OS
        </Heading>
        <p className="hero__subtitle">
          The professional identity engine that synthesizes complete AI experts
          from a role input — and deploys them across chat, voice, avatar, and
          humanoid interfaces.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "2rem" }}>
          <Link className="button button--primary button--lg" to="/docs/getting-started/overview">
            Get Started
          </Link>
          <Link className="button button--outline button--lg" to="/docs/vision/thesis">
            Read the Vision
          </Link>
        </div>
      </div>
    </header>
  );
}

function StatsBar() {
  return (
    <section className="container">
      <div className="stats-bar">
        {STATS.map((stat, idx) => (
          <div key={idx}>
            <div className="stat-item__number">{stat.number}</div>
            <div className="stat-item__label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="container" style={{ padding: "2rem 0 4rem" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <Heading as="h2" style={{ fontSize: "2.2rem", fontWeight: 800 }}>
          Platform Capabilities
        </Heading>
        <p style={{ color: "var(--sos-section-muted)", maxWidth: 600, margin: "0 auto" }}>
          Not a chatbot. Not a copilot. A professional identity engine that operates as the expert.
        </p>
      </div>
      <div className="features-grid">
        {FEATURES.map((feature, idx) => (
          <Link key={idx} to={feature.link} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="feature-card">
              <div className="feature-card__icon">
                <feature.Icon />
              </div>
              <div className="feature-card__title">{feature.title}</div>
              <div className="feature-card__description">{feature.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const FIVE_LAYER_DIAGRAM = `
graph TB
  subgraph L4["LAYER 4 — INTERFACES"]
    direction LR
    L4a["Chat"] ~~~ L4b["Voice"] ~~~ L4c["Avatar"] ~~~ L4d["API"] ~~~ L4e["Humanoid SDK"] ~~~ L4f["IoT Mesh"]
  end
  subgraph L3["LAYER 3 — SOP ENGINE"]
    direction LR
    L3a["Workflow Gen"] ~~~ L3b["Escalation"] ~~~ L3c["Audit Trail"] ~~~ L3d["Compliance"]
  end
  subgraph L2["LAYER 2 — IDENTITY CORE"]
    direction LR
    L2a["Knowledge RAG"] ~~~ L2b["Behavior Model"] ~~~ L2c["Memory"] ~~~ L2d["Goal Stack"]
  end
  subgraph L1["LAYER 1 — INPUT PROCESSING"]
    direction LR
    L1a["Role Parser"] ~~~ L1b["Org DNA"] ~~~ L1c["Jurisdiction"] ~~~ L1d["Personality"]
  end
  subgraph L0["LAYER 0 — LEARNING INFRASTRUCTURE"]
    direction LR
    L0a["Shift Debrief"] ~~~ L0b["SOP Update"] ~~~ L0c["Federated Learning"]
  end

  L4 --> L3 --> L2 --> L1 --> L0

  style L4 fill:#4f46e5,color:#fff,stroke:none,rx:8
  style L3 fill:#6366f1,color:#fff,stroke:none,rx:8
  style L2 fill:#7c3aed,color:#fff,stroke:none,rx:8
  style L1 fill:#8b5cf6,color:#fff,stroke:none,rx:8
  style L0 fill:#a78bfa,color:#fff,stroke:none,rx:8
`;

function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { colorMode } = useColorMode();

  useEffect(() => {
    if (!ref.current) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: colorMode === "dark" ? "dark" : "default",
      fontFamily: "Inter, system-ui, sans-serif",
    });
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
    mermaid.render(id, chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [chart, colorMode]);

  return <div ref={ref} style={{ display: "flex", justifyContent: "center" }} />;
}

function ArchitecturePreview() {
  return (
    <section className="container" style={{ padding: "2rem 0 4rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <Heading as="h2" style={{ fontSize: "2.2rem", fontWeight: 800 }}>
          Five-Layer Stack
        </Heading>
      </div>
      <div className="architecture-block" style={{ padding: "2rem 1rem" }}>
        <MermaidDiagram chart={FIVE_LAYER_DIAGRAM} />
      </div>
      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <Link className="button button--outline button--primary" to="/docs/technical/architecture">
          Explore the Architecture &rarr;
        </Link>
      </div>
    </section>
  );
}

function RoadmapSection() {
  return (
    <section className="container" style={{ padding: "2rem 0 4rem" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <Heading as="h2" style={{ fontSize: "2.2rem", fontWeight: 800 }}>
          Roadmap
        </Heading>
      </div>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {PHASES.map((p, idx) => (
          <div key={idx} className="roadmap-phase">
            <div style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}>
              <strong style={{ color: "var(--ifm-color-primary)" }}>{p.phase}</strong>
              <span className="badge--alpha">{p.status}</span>
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.25rem" }}>{p.title}</div>
            <div style={{ color: "var(--sos-section-muted)", fontSize: "0.9rem" }}>{p.time}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="cta-section glow-bg">
      <div className="container">
        <Heading as="h2" style={{ fontSize: "2.5rem", fontWeight: 900 }}>
          The workforce is a right,<br />not a privilege.
        </Heading>
        <p style={{ color: "var(--sos-section-muted)", maxWidth: 600, margin: "1rem auto 2rem" }}>
          290 million people lack access to adequate healthcare. Not because the knowledge
          does not exist — but because there was never a mechanism to distribute it.
          Until now.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link className="button button--primary button--lg" to="/docs/getting-started/overview">
            Start Building
          </Link>
          <Link className="button button--outline button--lg" to="/docs/strategy/why-build">
            Why Build This
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <HeroBanner />
      <StatsBar />
      <FeaturesSection />
      <ArchitecturePreview />
      <RoadmapSection />
      <CTASection />
    </Layout>
  );
}
