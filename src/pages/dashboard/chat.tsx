import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["candidate", "church"]);

type ChatMessage = { id: string; role: string; content: string; createdAt: string };

/** M5 ShepherdAI chat: coaching on your search. Trial members get 10 messages total. */
export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remaining, setRemaining] = useState<number | "unlimited" | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ messages: ChatMessage[]; remaining: number | "unlimited" }>("/api/chat")
      .then((d) => {
        setMessages(d.messages);
        setRemaining(d.remaining);
      })
      .catch((e) => setError(e as ApiError));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const temp: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, temp]);
    try {
      const d = await apiFetch<{ reply: string; remaining: number | "unlimited" }>("/api/chat", { method: "POST", body: { message: text } });
      setMessages((m) => [
        ...m.filter((x) => x.id !== temp.id),
        temp,
        { id: `asst-${Date.now()}`, role: "assistant", content: d.reply, createdAt: new Date().toISOString() },
      ]);
      setRemaining(d.remaining);
    } catch (err) {
      setError(err as ApiError);
      setMessages((m) => m.filter((x) => x.id !== temp.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="ShepherdAI">
      <div className="container" style={{ padding: "32px 16px 64px", maxWidth: 720 }}>
        <p className="label">ShepherdAI · coaching</p>
        <h1>Talk through your search</h1>
        <p className="muted">
          {remaining === null
            ? ""
            : remaining === "unlimited"
              ? "Unlimited messages on your membership."
              : `${remaining} trial message${remaining === 1 ? "" : "s"} left.`}{" "}
          <Link href="/pricing">Membership</Link> unlocks the full search.
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        <div style={{ display: "grid", gap: 12, margin: "16px 0" }}>
          {messages.length === 0 && (
            <p className="muted">No messages yet. Ask about a role you are considering, or how to read a match.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="card" style={{ background: m.role === "assistant" ? undefined : "#f4efe7" }}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send}>
          <div className="field">
            <label htmlFor="chat-input">Your message</label>
            <textarea id="chat-input" rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="What should I ask a church about their search process?" />
          </div>
          <button className="btn btn-primary" disabled={busy || !input.trim()}>
            {busy ? "Thinking…" : "Send"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
