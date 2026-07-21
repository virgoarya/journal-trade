export const dynamic = "force-dynamic";
export const revalidate = 3600;

import React from "react";
import { getCotData } from "@/lib/cot-service";
import { CotPanelClient } from "./CotPanelClient";

export default async function CotPanel() {
  const cotData = await getCotData();
  return <CotPanelClient cotData={cotData} />;
}
