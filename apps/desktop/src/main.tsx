import "./phone/env";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PHONE } from "./ore";
import { PhoneApp } from "./phone/PhoneApp";
import { HintProvider } from "./Hint";
import { suppressPageMenu } from "./native-menu";
import { QuickQuiz } from "./QuickQuiz";
import "./styles.css";
import "./retro.css";
import "./tailwind.css";

suppressPageMenu(document);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HintProvider>
      {/* The same page serves the quick quiz window (D76). */}
      {PHONE ? <PhoneApp /> : getCurrentWindow().label === "quiz" ? <QuickQuiz /> : <App />}
    </HintProvider>
  </StrictMode>,
);
