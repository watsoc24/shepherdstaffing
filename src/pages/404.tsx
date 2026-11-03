import Link from "next/link";
import { Layout } from "@/components/Layout";

export default function NotFound() {
  return (
    <Layout title="Page not found">
      <div className="container" style={{ padding: "64px 16px" }}>
        <h1>We couldn&apos;t find that page.</h1>
        <p><Link href="/">Return home</Link></p>
      </div>
    </Layout>
  );
}
