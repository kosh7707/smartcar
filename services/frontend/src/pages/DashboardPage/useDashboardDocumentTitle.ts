import { useEffect } from "react";

export function useDashboardDocumentTitle() {
  useEffect(() => {
    document.title = "AEGIS — Dashboard";
  }, []);
}
