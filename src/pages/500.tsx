import Link from "next/link";
import { Layout } from "@/components/Layout";

export default function ServerError() {
  return (
    <Layout title="Something went wrong">
      <div className="container" style={{ padding: "64px 16px" }}>
        <h1>Something went wrong on our side.</h1>
        <p>Please try again in a moment. <Link href="/">Return home</Link></p>
      </div>
    </Layout>
  );
}
