import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Banner } from "@/components/Banner";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmail() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");
  const sent = useRef(false);

  useEffect(() => {
    if (!router.isReady || sent.current) return;
    const token = router.query.token;
    if (typeof token !== "string") {
      setState("error");
      setMessage("This link is missing its token. Please use the link from your email.");
      return;
    }
    sent.current = true; // the token is single-use; never submit it twice
    apiFetch("/api/auth/verify", { body: { token } })
      .then(async () => {
        setState("ok");
        await refresh();
        setTimeout(() => void router.replace("/dashboard"), 1500);
      })
      .catch((err: ApiError) => {
        setState("error");
        setMessage(err.message);
      });
  }, [router, refresh]);

  return (
    <AuthCard title="Confirming your email">
      {state === "working" && <p>One moment…</p>}
      {state === "ok" && <Banner tone="success">Email confirmed — your 7-day trial has started. Taking you to your dashboard…</Banner>}
      {state === "error" && (
        <>
          <Banner tone="error">{message}</Banner>
          <p><Link href="/login">Go to sign in</Link> to request a new link.</p>
        </>
      )}
    </AuthCard>
  );
}
