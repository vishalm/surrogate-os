'use client';

import { clsx } from 'clsx';
import { Plus, Minus, Pencil } from 'lucide-react';
import type { SOPGraph } from '@surrogate-os/shared';

interface GraphDiffProps {
  currentGraph: SOPGraph;
  proposedGraph: SOPGraph;
  diff: Record<string, unknown>;
}

interface DiffNode {
  id: string;
  label: string;
  type?: string;
  description?: string;
}

interface DiffEdge {
  id: string;
  from: string;
  to: string;
  condition?: string | null;
  label?: string | null;
}

interface ModifiedNode {
  before: DiffNode;
  after: DiffNode;
}

interface ModifiedEdge {
  before: DiffEdge;
  after: DiffEdge;
}

export default function GraphDiffView({ currentGraph, proposedGraph, diff }: GraphDiffProps) {
  const addedNodes = (diff.addedNodes ?? []) as DiffNode[];
  const removedNodes = (diff.removedNodes ?? []) as DiffNode[];
  const modifiedNodes = (diff.modifiedNodes ?? []) as ModifiedNode[];
  const addedEdges = (diff.addedEdges ?? []) as DiffEdge[];
  const removedEdges = (diff.removedEdges ?? []) as DiffEdge[];
  const modifiedEdges = (diff.modifiedEdges ?? []) as ModifiedEdge[];

  const hasNodeChanges = addedNodes.length > 0 || removedNodes.length > 0 || modifiedNodes.length > 0;
  const hasEdgeChanges = addedEdges.length > 0 || removedEdges.length > 0 || modifiedEdges.length > 0;

  if (!hasNodeChanges && !hasEdgeChanges) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">No structural changes detected.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Node changes */}
      {hasNodeChanges && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Node Changes
          </h4>
          <div className="space-y-2">
            {addedNodes.map((node) => (
              <DiffItem
                key={`add-${node.id}`}
                type="added"
                label={node.label}
                detail={`${node.type ?? 'unknown'} — ${node.id}`}
              />
            ))}
            {removedNodes.map((node) => (
              <DiffItem
                key={`rm-${node.id}`}
                type="removed"
                label={node.label}
                detail={`${node.type ?? 'unknown'} — ${node.id}`}
              />
            ))}
            {modifiedNodes.map((mod) => (
              <DiffItem
                key={`mod-${mod.before.id}`}
                type="modified"
                label={mod.after.label}
                detail={`${mod.before.label} -> ${mod.after.label}${mod.before.type !== mod.after.type ? ` (type: ${mod.before.type} -> ${mod.after.type})` : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edge changes */}
      {hasEdgeChanges && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Edge Changes
          </h4>
          <div className="space-y-2">
            {addedEdges.map((edge) => (
              <DiffItem
                key={`add-edge-${edge.id}`}
                type="added"
                label={edge.id}
                detail={`${edge.from} -> ${edge.to}${edge.condition ? ` [${edge.condition}]` : ''}`}
              />
            ))}
            {removedEdges.map((edge) => (
              <DiffItem
                key={`rm-edge-${edge.id}`}
                type="removed"
                label={edge.id}
                detail={`${edge.from} -> ${edge.to}`}
              />
            ))}
            {modifiedEdges.map((mod) => (
              <DiffItem
                key={`mod-edge-${mod.before.id}`}
                type="modified"
                label={mod.after.id}
                detail={`${mod.before.from}->${mod.before.to} changed to ${mod.after.from}->${mod.after.to}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffItem({
  type,
  label,
  detail,
}: {
  type: 'added' | 'removed' | 'modified';
  label: string;
  detail: string;
}) {
  const config = {
    added: {
      icon: Plus,
      border: 'border-[var(--color-success)]/20',
      bg: 'bg-[var(--color-success)]/5',
      iconColor: 'text-[var(--color-success)]',
    },
    removed: {
      icon: Minus,
      border: 'border-[var(--color-danger)]/20',
      bg: 'bg-[var(--color-danger)]/5',
      iconColor: 'text-[var(--color-danger)]',
    },
    modified: {
      icon: Pencil,
      border: 'border-[var(--color-warning)]/20',
      bg: 'bg-[var(--color-warning)]/5',
      iconColor: 'text-[var(--color-warning)]',
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className={clsx('flex items-start gap-2 rounded-md border p-2', config.border, config.bg)}>
      <Icon className={clsx('mt-0.5 h-3.5 w-3.5 shrink-0', config.iconColor)} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="text-xs text-[var(--color-text-secondary)] truncate">{detail}</p>
      </div>
    </div>
  );
}
