import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadMarkdownLibs } from "./loadMarkdownLibs";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root");
}

void loadMarkdownLibs().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
