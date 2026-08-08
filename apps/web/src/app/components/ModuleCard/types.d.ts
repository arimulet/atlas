import React from "react";

export interface ModuleCardProps {
  status: ModuleCardStatus;
  label: string;
  summary: string;
  children?: React.ReactNode;
}

export type ModuleCardStatus = "available" | "ready" | "planned";
