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
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { SOPNode, SOPEdge } from '@surrogate-os/shared';
import { SOPNodeType } from '@surrogate-os/shared';
import { Badge } from '@/components/ui';

interface ExecutionGraphProps {
  graph: {
    nodes: SOPNode[];
    edges: SOPEdge[];
  };
  currentNodeId: string;
  visitedNodes: string[];
  availableTransitions?: { edgeId: string; targetNodeId: string }[];
  onTransitionClick?: (edgeId: string) => void;
}

const NODE_TYPE_CONFIG: Record<
  SOPNodeType,
  { icon: typeof Search; color: string; activeColor: string; label: string }
> = {
  [SOPNodeType.INFORMATION_GATHER]: {
    icon: Search,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    activeColor: 'text-blue-600 bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/40',
    label: 'Information Gather',
  },
  [SOPNodeType.ASSESSMENT]: {
    icon: ClipboardCheck,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    activeColor: 'text-indigo-600 bg-indigo-500/20 border-indigo-500 ring-2 ring-indigo-500/40',
    label: 'Assessment',
  },
  [SOPNodeType.DECISION]: {
    icon: GitBranch,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    activeColor: 'text-amber-600 bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40',
    label: 'Decision',
  },
  [SOPNodeType.ACTION_DIGITAL]: {
    icon: Monitor,
    color: 'text-green-500 bg-green-500/10 border-green-500/30',
    activeColor: 'text-green-600 bg-green-500/20 border-green-500 ring-2 ring-green-500/40',
    label: 'Digital Action',
  },
  [SOPNodeType.ACTION_PHYSICAL]: {
    icon: Wrench,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    activeColor: 'text-orange-600 bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/40',
    label: 'Physical Action',
  },
  [SOPNodeType.CHECKPOINT]: {
    icon: ShieldCheck,
    color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    activeColor: 'text-cyan-600 bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/40',
    label: 'Checkpoint',
  },
  [SOPNodeType.ESCALATION]: {
    icon: AlertTriangle,
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
    activeColor: 'text-red-600 bg-red-500/20 border-red-500 ring-2 ring-red-500/40',
    label: 'Escalation',
  },
  [SOPNodeType.DOCUMENTATION]: {
    icon: FileText,
    color: 'text-slate-500 bg-slate-500/10 border-slate-500/30',
    activeColor: 'text-slate-600 bg-slate-500/20 border-slate-500 ring-2 ring-slate-500/40',
    label: 'Documentation',
  },
  [SOPNodeType.HANDOVER]: {
    icon: ArrowRightLeft,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    activeColor: 'text-purple-600 bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/40',
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

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}

function ExecutionNodeCard({
  node,
  outgoingEdges,
  isCurrent,
  isVisited,
  isReachable,
  onTransitionClick,
}: {
  node: SOPNode;
  outgoingEdges: SOPEdge[];
  isCurrent: boolean;
  isVisited: boolean;
  isReachable: boolean;
  onTransitionClick?: (edgeId: string) => void;
}) {
  const config = NODE_TYPE_CONFIG[node.type] ?? NODE_TYPE_CONFIG[SOPNodeType.DOCUMENTATION];
  const Icon = config.icon;

  const isDimmed = !isCurrent && !isVisited && !isReachable;

  return (
    <div
      className={clsx(
        'relative rounded-lg border p-4 transition-all duration-300',
        isCurrent
          ? config.activeColor
          : isVisited
            ? 'border-green-500/30 bg-green-500/5'
            : isDimmed
              ? 'opacity-40 border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
              : config.color,
      )}
    >
      {/* Current node pulsing indicator */}
      {isCurrent && (
        <div className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--color-primary)]" />
        </div>
      )}

      {/* Visited checkmark */}
      {isVisited && !isCurrent && (
        <div className="absolute -right-1 -top-1">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={clsx(
          'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border',
          isCurrent ? 'bg-white/70' : isVisited ? 'bg-green-500/10 border-green-500/20' : 'bg-white/50',
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
              {config.label}
            </p>
            {isCurrent && (
              <Badge variant="default" className="text-[9px]">CURRENT</Badge>
            )}
          </div>
          <h4 className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
            {node.label}
          </h4>
          {node.description && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {node.description}
            </p>
          )}
          {isCurrent && onTransitionClick && outgoingEdges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {outgoingEdges.map((edge) => (
                <button
                  key={edge.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransitionClick(edge.id);
                  }}
                  className="rounded-md bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
                >
                  {edge.label ?? edge.condition ?? 'next'}
                </button>
              ))}
            </div>
          )}
          {!isCurrent && outgoingEdges.length > 0 && (
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

function EdgeConnector({ edges, isTraversed }: { edges: SOPEdge[]; isTraversed: boolean }) {
  const hasMultiple = edges.length > 1;

  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center">
        <div className={clsx(
          'h-4 w-px',
          isTraversed ? 'bg-green-500' : 'bg-[var(--color-border)]',
        )} />
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
          <svg className={clsx('h-2 w-2', isTraversed ? 'text-green-500' : 'text-[var(--color-text-muted)]')} viewBox="0 0 8 8">
            <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="currentColor" />
          </svg>
        )}
        <div className={clsx(
          'h-4 w-px',
          isTraversed ? 'bg-green-500' : 'bg-[var(--color-border)]',
        )} />
      </div>
    </div>
  );
}

export default function ExecutionGraph({
  graph,
  currentNodeId,
  visitedNodes,
  availableTransitions = [],
  onTransitionClick,
}: ExecutionGraphProps) {
  const { nodes, edges } = graph;

  const visitedSet = useMemo(() => new Set(visitedNodes), [visitedNodes]);
  const reachableSet = useMemo(
    () => new Set(availableTransitions.map((t) => t.targetNodeId)),
    [availableTransitions],
  );

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
        const isCurrent = node.id === currentNodeId;
        const isVisited = visitedSet.has(node.id);
        const isReachable = reachableSet.has(node.id);

        // Check if the edge between this node and the next was traversed
        const nextNode = index < orderedNodes.length - 1 ? orderedNodes[index + 1] : null;
        const isEdgeTraversed = isVisited && nextNode ? visitedSet.has(nextNode.id) : false;

        return (
          <div key={node.id}>
            <ExecutionNodeCard
              node={node}
              outgoingEdges={outgoingEdges}
              isCurrent={isCurrent}
              isVisited={isVisited && !isCurrent}
              isReachable={isReachable}
              onTransitionClick={onTransitionClick}
            />
            {!isLast && (
              <EdgeConnector edges={outgoingEdges} isTraversed={isEdgeTraversed} />
            )}
          </div>
        );
      })}
    </div>
  );
}
