import { EidaIcon } from "@/components/ui/eida-icon";

type Tool = "parts" | "inspect" | "evidence" | "quality" | "grid" | "reset";

const tools = [
  { id: "parts", icon: "list", label: "Parts" },
  { id: "inspect", icon: "search", label: "Inspect" },
  { id: "evidence", icon: "link", label: "Evidence" },
  { id: "grid", icon: "grid", label: "Grid" },
  { id: "quality", icon: "palette", label: "Quality" },
  { id: "reset", icon: "gears", label: "Reset" },
] as const;

export function ViewerToolbar({
  activeTools,
  onAction,
}: {
  activeTools: Tool[];
  onAction: (tool: Tool) => void;
}) {
  return (
    <nav className="viewer-toolbar" aria-label="Viewer tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={activeTools.includes(tool.id) ? "is-active" : ""}
          aria-pressed={
            tool.id === "reset" ? undefined : activeTools.includes(tool.id)
          }
          onClick={() => onAction(tool.id)}
        >
          <EidaIcon name={tool.icon} size={18} />
          <small>{tool.label}</small>
        </button>
      ))}
    </nav>
  );
}

export type { Tool };
