import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">ATLAS</p>
        <h1>Player diagnosis bootstrap</h1>
        <p>
          Initial software shell for importing player snapshots, validating observed data and
          keeping diagnosis logic outside the user interface.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
