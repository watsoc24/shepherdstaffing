import type { ReactNode } from "react";
import { Layout } from "./Layout";

export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <Layout title={title}>
      <div className="container" style={{ padding: "40px 16px 64px" }}>
        <div className="card auth-card">
          <h1 style={{ fontSize: "2rem" }}>{title}</h1>
          {intro && <div style={{ color: "var(--muted)", marginBottom: 16 }}>{intro}</div>}
          {children}
        </div>
      </div>
    </Layout>
  );
}
