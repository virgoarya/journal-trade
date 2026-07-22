"use client";

import React, { useMemo } from "react";

const VALETAX_EMBED = `<iframe src="https://ma.valetax.com/embed/register/block/%2FVnB%2BKHlS7fIPaqJdAVra770S6pPsLrWAulIB5XEzSxd7mrTkwAxNaF6l8n94tfVMK3cyIQFJvPY6Pi2Or%2BlTcwXADDWr2%2FU1%2FuaT0kelI6KExChGGcFvILbWhbleMpN?lang=en&background=dark" width="100%" height="490px" title="Valetax Registration"></iframe>`;

export function ValetaxRegistrationIframe() {
  // Memastikan iframe hanya dirender sekali dan tidak di-re-render oleh perubahan state parent
  const memoizedIframe = useMemo(() => {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: VALETAX_EMBED }}
        className="[&_iframe]:w-full"
      />
    );
  }, []); // Dependensi kosong agar hanya dieksekusi sekali saat mount

  return (
    <div className="bg-bg-surface rounded-xl overflow-hidden border border-border-subtle">
      {memoizedIframe}
    </div>
  );
}
