import type { Metadata } from "next";
import { EidaDocumentation } from "@/features/documentation/eida-documentation";

export const metadata: Metadata = {
  title: "Documentation · EIDA",
  description:
    "Install EIDA, connect the Meta Model API, and enable the MapAnything worker.",
};

export default function DocumentationPage() {
  return <EidaDocumentation />;
}
