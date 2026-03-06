import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tailwind.css";
import "./styles/index.css";
import { initGlobalErrorReporting } from './services/errorReportingService';

// Initialize global error reporting before app renders
initGlobalErrorReporting();

const container = document.getElementById("root");
const root = createRoot(container);

root.render(<App />);
