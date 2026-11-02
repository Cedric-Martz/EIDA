import type { Metadata } from "next";
import { EidaDocumentation } from "@/features/documentation/eida-documentation";

export const metadata: Metadata = {
  title: "Documentation · EIDA",
  description:
    "Installer EIDA, connecter Meta Model API et activer le worker MapAnything.",
};

export default function DocumentationPage() {
  return <EidaDocumentation />;
}
