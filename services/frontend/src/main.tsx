import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initTheme } from "./utils/theme";

import "./index.css";
import "./styles/handoff/fonts.css";
import "./styles/handoff/tokens.css";
import "./styles/handoff/base.css";
import "./styles/handoff/compat.css";
import "./styles/handoff/components/button.css";
import "./styles/handoff/components/input.css";
import "./styles/handoff/components/panel.css";
import "./styles/handoff/components/pill.css";
import "./styles/handoff/components/seg.css";
import "./styles/handoff/components/toggle.css";
import "./styles/handoff/components/severity.css";
import "./styles/handoff/components/lang-tag.css";
import "./styles/handoff/components/divider.css";
import "./styles/handoff/components/choreography.css";
import "./styles/handoff/components/nav.css";
import "./styles/handoff/auth-console.css";
import "./styles/handoff/pages/login.css";
import "./styles/handoff/pages/signup.css";
import "./styles/handoff/pages/dashboard.css";
import "./styles/handoff/app-shell.css";
import "./styles/handoff/page-surfaces.css";

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
