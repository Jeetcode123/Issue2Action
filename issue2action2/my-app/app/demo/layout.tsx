import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Issue2Action — Live Demo",
  description: "Live end-to-end pipeline demonstration of Issue2Action civic reporting platform",
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark" style={{ height: '100vh', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
