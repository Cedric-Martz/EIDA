import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "EIDA",
  description:
    "Evidence-grounded 3D reconstruction for exploring electronic devices",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
