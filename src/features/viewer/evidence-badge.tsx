import type { ComponentNode } from "@/domain/evidence/schema";

type EvidenceStatus = ComponentNode["claims"][number]["status"];

const statusContent: Record<
  EvidenceStatus,
  { label: string; symbol: string; description: string }
> = {
  observed: {
    label: "Observed",
    symbol: "●",
    description: "Visible in a photograph or measurement.",
  },
  documented: {
    label: "Documented",
    symbol: "▣",
    description: "Supported by an identified source.",
  },
  inferred: {
    label: "Estimated",
    symbol: "◐",
    description: "A hypothesis that still needs confirmation.",
  },
  unknown: {
    label: "Unknown",
    symbol: "◇",
    description: "No admissible evidence is available.",
  },
};

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const content = statusContent[status];
  return (
    <span
      className={`evidence-badge evidence-badge--${status}`}
      title={content.description}
    >
      <span aria-hidden="true">{content.symbol}</span>
      {content.label}
    </span>
  );
}

export function EvidenceLegend() {
  return (
    <div className="evidence-legend" aria-label="Evidence level legend">
      {(Object.keys(statusContent) as EvidenceStatus[]).map((status) => (
        <EvidenceBadge key={status} status={status} />
      ))}
    </div>
  );
}
