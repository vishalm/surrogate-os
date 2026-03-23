'use client';

import { useMemo } from 'react';
import {
  Search,
  ClipboardCheck,
  GitBranch,
  Monitor,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  FileText,
  ArrowRightLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { SOPNode, SOPEdge } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';
import { Badge } from '@/components/ui';

interface SOPGraphViewProps {
  graph: {
    nodes: SOPNode[];
    edges: SOPEdge[];
  };
}

const NODE_TYPE_CONFIG: Record<
  SOPNodeType,
  { icon: typeof Search; color: string; label: string }
> = {
  [SOPNodeType.INFORMATION_GATHER]: {
    icon: Search,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    label: 'Information Gather',
  },
  [SOPNodeType.ASSESSMENT]: {
    icon: ClipboardCheck,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    label: 'Assessment',
  },
  [SOPNodeType.DECISION]: {
    icon: GitBranch,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    label: 'Decision',
  },
  [SOPNodeType.ACTION_DIGITAL]: {
    icon: Monitor,
    color: 'text-green-500 bg-green-500/10 border-green-500/30',
    label: 'Digital Action',
  },
  [SOPNodeType.ACTION_PHYSICAL]: {
    icon: Wrench,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    label: 'Physical Action',
  },
  [SOPNodeType.CHECKPOINT]: {
    icon: ShieldCheck,
    color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    label: 'Checkpoint',
  },
  [SOPNodeType.ESCALATION]: {
    icon: AlertTriangle,
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
    label: 'Escalation',
  },
  [SOPNodeType.DOCUMENTATION]: {
    icon: FileText,
    color: 'text-slate-500 bg-slate-500/10 border-slate-500/30',
    label: 'Documentation',
  },
  [SOPNodeType.HANDOVER]: {
    icon: ArrowRightLeft,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    label: 'Handover',
  },
};

function buildOrderedNodes(nodes: SOPNode[], edges: SOPEdge[]): SOPNode[] {
  if (nodes.length === 0) return [];

  const targetIds = new Set(edges.map((e) => e.to));
  const startNodes = nodes.filter((n) => !targetIds.has(n.id));
  if (startNodes.length === 0) return nodes;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = adjacency.get(edge.from) ?? [];
    existing.push(edge.to);
    adjacency.set(edge.from, existing);
  }

  const visited = new Set<string>();
  const ordered: SOPNode[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) ordered.push(node);
    const children = adjacency.get(nodeId) ?? [];
    for (const childId of children) {
      traverse(childId);
    }
  }

  for (const start of startNodes) {
    traverse(start.id);
  }

  // Add any unvisited nodes at the end
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}

function NodeCard({ node, outgoingEdges }: { node: SOPNode; outgoingEdges: SOPEdge[] }) {
  const config = NODE_TYPE_CONFIG[node.type] ?? NODE_TYPE_CONFIG[SOPNodeType.DOCUMENTATION];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        config.color,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border bg-white/50">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
            {config.label}
          </p>
          <h4 className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
            {node.label}
          </h4>
          {node.description && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {node.description}
            </p>
          )}
          {outgoingEdges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {outgoingEdges.map((edge) => (
                <Badge key={edge.id} variant="muted" className="text-[10px]">
                  {edge.label ?? edge.condition ?? 'next'}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EdgeConnector({ edges }: { edges: SOPEdge[] }) {
  const hasMultiple = edges.length > 1;

  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center">
        <div className="h-4 w-px bg-[var(--color-border)]" />
        {hasMultiple ? (
          <div className="flex items-center gap-1">
            {edges.map((edge) => (
              <span
                key={edge.id}
                className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
              >
                {edge.condition ?? edge.label ?? ''}
              </span>
            ))}
          </div>
        ) : (
          <svg className="h-2 w-2 text-[var(--color-text-muted)]" viewBox="0 0 8 8">
            <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="currentColor" />
          </svg>
        )}
        <div className="h-4 w-px bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

export default function SOPGraphView({ graph }: SOPGraphViewProps) {
  const { nodes, edges } = graph;

  const edgesBySource = useMemo(() => {
    const map = new Map<string, SOPEdge[]>();
    for (const edge of edges) {
      const existing = map.get(edge.from) ?? [];
      existing.push(edge);
      map.set(edge.from, existing);
    }
    return map;
  }, [edges]);

  const orderedNodes = useMemo(
    () => buildOrderedNodes(nodes, edges),
    [nodes, edges],
  );

  if (nodes.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
        No nodes defined in this SOP graph
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {orderedNodes.map((node, index) => {
        const outgoingEdges = edgesBySource.get(node.id) ?? [];
        const isLast = index === orderedNodes.length - 1;

        return (
          <div key={node.id}>
            <NodeCard node={node} outgoingEdges={outgoingEdges} />
            {!isLast && (
              <EdgeConnector edges={outgoingEdges} />
            )}
          </div>
        );
      })}
    </div>
  );
}
