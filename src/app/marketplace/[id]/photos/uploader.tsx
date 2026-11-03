"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadListingPhoto } from "../../actions";

/** Shrinks an image in the browser and re-encodes it as JPEG (drops EXIF/GPS). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

export function PhotoUploader({ listingId, remaining }: { listingId: string; remaining: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [attest, setAttest] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, remaining);
    start(async () => {
      for (const [i, file] of list.entries()) {
        setStatus(`Uploading ${i + 1} of ${list.length}…`);
        try {
          const blob = await shrink(file);
          const fd = new FormData();
          fd.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
          fd.set("attest", "yes");
          const res = await uploadListingPhoto(listingId, fd);
          if (res.error) {
            setStatus(res.error);
            return;
          }
        } catch {
          setStatus("Couldn't process that photo. Try another one.");
          return;
        }
      }
      setStatus("Done!");
      if (input.current) input.current.value = "";
      router.refresh();
    });
  };

  if (remaining <= 0) return <p className="text-sm text-gray-600">You&apos;ve added the maximum of 8 photos.</p>;

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
        <span>
          These photos show only the item. There are no people (including children), faces, names, school logos or
          addresses in them.
        </span>
      </label>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        disabled={!attest || pending}
        onChange={(e) => onFiles(e.target.files)}
        className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-600 file:px-4 file:font-semibold file:text-white disabled:opacity-50"
        aria-label="Choose photos"
      />
      {status ? <p role="status" className="text-sm text-gray-700">{status}</p> : null}
    </div>
  );
}
