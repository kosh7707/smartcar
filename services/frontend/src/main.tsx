import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initTheme } from "./utils/theme";

import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/animations.css";
import "./styles/layout.css";
import "./styles/utilities.css";
import "./index.css";
import "./styles/shadcn-app.css";

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
