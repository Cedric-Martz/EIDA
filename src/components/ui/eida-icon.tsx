import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightUp,
  ArrowUp,
  Camera,
  Check,
  Cross,
  ExternalLink,
  Gallery,
  Gears,
  Grid,
  Info,
  Link,
  List,
  Palette,
  Paper,
  Plus,
  Search,
  Sparkles,
  Tasks,
} from "@getpapillon/papicons";
import type { ComponentType, SVGProps } from "react";

export type IconName =
  | "alert"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "camera"
  | "check"
  | "close"
  | "external"
  | "gallery"
  | "gears"
  | "grid"
  | "info"
  | "link"
  | "list"
  | "palette"
  | "paper"
  | "plus"
  | "search"
  | "sparkles"
  | "tasks";

type IconComponent = ComponentType<
  { size?: number; color?: string; opacity?: number } & SVGProps<SVGSVGElement>
>;

type EidaIconProps = Omit<SVGProps<SVGSVGElement>, "color" | "opacity"> & {
  name: IconName;
  size?: number;
  color?: string;
  opacity?: number;
};

const icons: Record<IconName, IconComponent> = {
  alert: AlertTriangle,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  camera: Camera,
  check: Check,
  close: Cross,
  external: ExternalLink ?? ArrowRightUp,
  gallery: Gallery,
  gears: Gears,
  grid: Grid,
  info: Info,
  link: Link,
  list: List,
  palette: Palette,
  paper: Paper,
  plus: Plus,
  search: Search,
  sparkles: Sparkles,
  tasks: Tasks,
};

export function EidaIcon({ name, size = 18, ...props }: EidaIconProps) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" focusable="false" size={size} {...props} />;
}
