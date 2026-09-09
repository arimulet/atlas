"use client";

import { use } from "react";
import { App } from "../../App";

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <App initialUrl={`/player/${encodeURIComponent(id)}`} />;
}
