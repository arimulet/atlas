import { useEffect, useRef } from "react";

import { MainContentProps } from "./types";

export function MainContent({ children, navigationKey }: MainContentProps) {
  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [navigationKey]);

  return (
    <main className="atlas-main-content" ref={mainContentRef}>
      {children}
    </main>
  );
}
