"use client";

import { usePathname } from "next/navigation";
import { formatBrowserTitle, getPageNameForPath } from "@/app/browser-title";

interface BrowserTitleProps {
  pageName?: string;
}

export function BrowserTitle({ pageName }: BrowserTitleProps) {
  const pathname = usePathname();
  const resolvedPageName =
    pageName ?? (pathname.startsWith("/player/") ? null : getPageNameForPath(pathname));

  if (resolvedPageName === null) {
    return null;
  }

  return <title>{formatBrowserTitle(resolvedPageName)}</title>;
}
