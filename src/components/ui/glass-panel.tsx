import type { HTMLAttributes, ReactNode } from "react";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  reducedGraphics?: boolean;
};

export function GlassPanel({
  children,
  className = "",
  reducedGraphics = false,
  ...props
}: GlassPanelProps) {
  const classes = [
    "glass-panel",
    reducedGraphics ? "glass-panel--opaque" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
