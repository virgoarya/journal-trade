"use client";

import React from "react";
import { MacroNexusDiagram } from "@/components/macro-terminal/nexus/MacroNexusDiagram";

export default function NexusPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <MacroNexusDiagram />
    </div>
  );
}
