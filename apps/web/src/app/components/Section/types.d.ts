import React from "react";

export interface SectionProps {
  className?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  tone?: SectionTone;
  children?: React.ReactNode;
}

export type SectionTone = "normal" | "error" | "warning";
