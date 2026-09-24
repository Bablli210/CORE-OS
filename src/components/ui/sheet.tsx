"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * docs/04 `Sheet`: bottom sheet on mobile, centered dialog on desktop. Built on <dialog> (focus trap, Esc to close).
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cn(
        "m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-xl border bg-background p-0 text-foreground backdrop:bg-foreground/40",
        "md:m-auto md:max-w-lg md:rounded-xl",
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="inline-flex size-tap items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="p-4">{open ? children : null}</div>
    </dialog>
  );
}
