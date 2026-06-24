"use client";
import type { Attachment } from "@/lib/types";

function human(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({ items }: { items: Attachment[] }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Sin adjuntos.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const isImage = a.contentType.startsWith("image/");
        return (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.name} className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-black/5 text-xs font-bold dark:bg-white/10">
                {a.name.split(".").pop()?.toUpperCase().slice(0, 4)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {human(a.size)} · {a.uploadedByName} · {a.kind === "technical" ? "técnico" : "general"}
              </p>
            </div>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost px-2 py-1 text-xs"
            >
              Abrir
            </a>
          </li>
        );
      })}
    </ul>
  );
}
