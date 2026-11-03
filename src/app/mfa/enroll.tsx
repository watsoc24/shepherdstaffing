"use client";

import { useState, useTransition } from "react";
import { startTotpEnrollment, verifyTotp } from "./actions";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/fields";

export function EnrollTotp({ next }: { next: string }) {
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!setup) {
    return (
      <div className="space-y-3">
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <button
          type="button"
          className="btn w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await startTotpEnrollment();
              if ("error" in res) setError(res.error);
              else setSetup(res);
            })
          }
        >
          {pending ? "Preparing…" : "Set up two-step verification"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
        <li>
          Install a free authenticator app (for example Google Authenticator or Microsoft Authenticator from the App
          Store), or use the Passwords app built into iPhone.
        </li>
        <li>
          On iPhone, the easiest way is to tap and hold the setup key below, copy it, and paste it into your
          authenticator app. On another device you can scan the QR code.
        </li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qrCode} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 bg-white" />
      <div>
        <p className="label">Setup key</p>
        <code className="block rounded-xl bg-gray-100 p-3 text-center font-mono text-base break-all select-all">
          {setup.secret}
        </code>
      </div>
      <ActionForm action={verifyTotp} submitLabel="Verify and finish">
        <input type="hidden" name="factorId" value={setup.factorId} />
        <input type="hidden" name="next" value={next} />
        <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
      </ActionForm>
    </div>
  );
}
