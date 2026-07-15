import { useEffect, useState } from "react";
export const mobileTaskMediaQuery = "(max-width: 767px)";
export function useResponsiveViewport() {
  const [isMobileTaskView, setMobileTaskView] = useState(() => typeof window !== "undefined" && window.matchMedia(mobileTaskMediaQuery).matches);
  useEffect(() => { const media = window.matchMedia(mobileTaskMediaQuery); const update = () => setMobileTaskView(media.matches); update(); if (media.addEventListener) media.addEventListener("change", update); else media.addListener(update); return () => { if (media.removeEventListener) media.removeEventListener("change", update); else media.removeListener(update); }; }, []);
  return { isMobileTaskView };
}
