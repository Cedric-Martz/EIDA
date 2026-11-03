import type { Metadata } from "next";
import { EidaDocumentation } from "@/features/documentation/eida-documentation";

export const metadata: Metadata = {
  title: "Documentation - EIDA",
  description:
    "Install EIDA, connect the Meta Model API, and reconstruct devices from reviewed web, photo, manual, and CAD evidence.",
};

export default function DocumentationPage() {
  return <EidaDocumentation />;
}
