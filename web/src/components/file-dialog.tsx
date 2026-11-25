/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function FileDialog({ label, children, onClose }: { label: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog className="file-dialog" ref={ref} aria-label={label}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content">
      <button className="icon-button dialog-close" type="button" aria-label="Close" onClick={onClose}><X size={20} /></button>
      {children}
    </div>
  </dialog>;
}
