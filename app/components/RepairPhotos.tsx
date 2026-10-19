'use client';

import { useRef, useState } from 'react';
import { Camera, ImageOff, Loader2, X } from 'lucide-react';
import { useFileViewer } from '@/context/FileViewerContext';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';

// Photos on a repair (the tenant's, the vendor's before and after, a dispute's). Every URL is a
// file-gateway link, so a plain <img> works: the gateway checks who is asking and redirects to a
// short-lived provider URL.

function Thumb({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-100 text-gray-400">
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px]">Open</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  );
}

export function PhotoGrid({
  urls,
  label = 'Photo',
  onRemove,
  emptyText,
}: {
  urls: string[];
  label?: string;
  onRemove?: (url: string) => void;
  emptyText?: string;
}) {
  const { openGallery } = useFileViewer();

  if (urls.length === 0) {
    return emptyText ? <p className="text-sm text-gray-400">{emptyText}</p> : null;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((url, i) => (
        <div
          key={url}
          className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        >
          <button
            type="button"
            onClick={() =>
              openGallery(
                urls.map((u, n) => ({ url: u, name: `${label} ${n + 1}`, type: 'image/jpeg' })),
                i,
              )
            }
            aria-label={`Open ${label.toLowerCase()} ${i + 1}`}
            className="block h-full w-full"
          >
            <Thumb url={url} />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Picks photos, uploads them to the repair folder and hands back the new gateway URLs. */
export function PhotoPicker({
  label,
  onUploaded,
  disabled,
  full,
}: {
  label: string;
  onUploaded: (urls: string[]) => void | Promise<void>;
  disabled?: boolean;
  /** The list is at its limit, so no more can be added. */
  full?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!uploadsEnabled()) {
    return (
      <p className="text-xs text-gray-500">
        Photo uploads are not set up on this site yet, so photos cannot be added.
      </p>
    );
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadFile(f, 'maintenance-requests')));
      await onUploaded(uploaded.map((u) => u.url));
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'A photo could not be uploaded. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label={label}
        onChange={handleFiles}
      />
      <button
        type="button"
        disabled={disabled || busy || full}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {busy ? 'Uploading…' : full ? 'Photo limit reached' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
