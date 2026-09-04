import React from "react";
import { createRoot } from "react-dom/client";
import DecisionTerritorialePage from "./DecisionPage";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DecisionTerritorialePage />
  </React.StrictMode>,
);
