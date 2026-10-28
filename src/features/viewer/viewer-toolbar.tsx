type Tool = "parts" | "inspect" | "evidence" | "quality" | "grid" | "reset";

const tools: { id: Tool; symbol: string; label: string }[] = [
  { id: "parts", symbol: "▤", label: "Parts" },
  { id: "inspect", symbol: "⌖", label: "Inspect" },
  { id: "evidence", symbol: "◇", label: "Evidence" },
  { id: "grid", symbol: "⌗", label: "Grid" },
  { id: "quality", symbol: "◒", label: "Quality" },
  { id: "reset", symbol: "↺", label: "Reset" },
];

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
          <span aria-hidden="true">{tool.symbol}</span>
          <small>{tool.label}</small>
        </button>
      ))}
    </nav>
  );
}

export type { Tool };
