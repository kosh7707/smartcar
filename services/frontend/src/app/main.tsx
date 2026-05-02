import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initTheme } from "@/common/utils/theme";

import "@/common/styles/fonts.css";
import "@/common/styles/typography.css";
import "@/common/styles/handoff/tokens.css";
import "@/common/styles/handoff/base.css";
import "@/common/styles/app-base.css";
import "@/common/styles/handoff/compat.css";
import "@/common/styles/button.css";
import "@/common/styles/input.css";
import "@/common/styles/panel.css";
import "@/common/styles/handoff/components/pill.css";
import "@/common/styles/handoff/components/seg.css";
import "@/common/styles/handoff/components/toggle.css";
import "@/common/styles/severity.css";
import "@/common/styles/handoff/components/lang-tag.css";
import "@/common/styles/handoff/components/divider.css";
import "@/common/styles/handoff/components/choreography.css";
import "@/common/styles/handoff/components/nav.css";
import "@/common/styles/handoff/components/status.css";
import "@/common/styles/handoff/components/distribution.css";
import "@/common/styles/dialog.css";
import "@/common/styles/handoff/components/kpi.css";
import "@/common/styles/handoff/components/list.css";
import "@/common/styles/handoff/components/markdown.css";
import "@/common/styles/toast.css";
import "@/common/styles/handoff/components/inline-stack.css";
import "@/common/styles/handoff/components/form-field.css";
import "@/common/styles/handoff/auth-console.css";
import "@/common/styles/handoff/pages/login.css";
import "@/common/styles/handoff/pages/signup.css";
import "@/common/styles/handoff/pages/dashboard.css";
import "@/common/styles/handoff/app-shell.css";
import "@/common/styles/handoff/page-surfaces.css";
import "@/common/styles/animations.css";

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
