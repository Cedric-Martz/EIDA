import type { ComponentNode } from "@/domain/evidence/schema";
import { EidaIcon, type IconName } from "@/components/ui/eida-icon";

type EvidenceStatus = ComponentNode["claims"][number]["status"];

const statusContent: Record<
  EvidenceStatus,
  { label: string; icon: IconName; description: string }
> = {
  observed: {
    label: "Observed",
    icon: "check",
    description: "Visible in a photograph or measurement.",
  },
  documented: {
    label: "Documented",
    icon: "paper",
    description: "Supported by an identified source.",
  },
  inferred: {
    label: "Estimated",
    icon: "info",
    description: "A hypothesis that still needs confirmation.",
  },
  unknown: {
    label: "Unknown",
    icon: "link",
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
      <EidaIcon name={content.icon} size={13} />
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
