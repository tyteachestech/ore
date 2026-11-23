import "./phone/env";

import { useDismissableLayerSurface } from "@radix-ui/react-dismissable-layer";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PHONE } from "./ore";
import { PhoneApp, PLACE } from "./phone/PhoneApp";
import { Boundary } from "./Boundary";
import { HintProvider } from "./Hint";
import { trackInput } from "./input-mode";
import { installGlide } from "./pill-glide";
import { suppressPageMenu } from "./native-menu";
import { typeWhereFocused } from "./typing";
import { QuickQuiz } from "./QuickQuiz";
import "./styles.css";
import "./retro.css";
import "./tailwind.css";

suppressPageMenu(document);
trackInput(document);
typeWhereFocused(document);
installGlide();

/** A click on a control that stops its own event still closes an open popover: Radix counts one that doesn't reach the document as
 *  taken, so it stays open, unless the click lands on a surface registered here (the whole page). */
function PopoverSurface() {
  const surface = useDismissableLayerSurface();
  useEffect(() => surface(document.body as HTMLElement as HTMLDivElement), [surface]);
  return null;
}

/** The way back from a crash nothing else caught: the app starts again. The phone reopens where it was left
 *  (its saved place), which may be the screen that broke, so there it starts on Today. */
const startOver = () => {
  try {
    if (PHONE) localStorage.removeItem(PLACE);
  } catch {}
  location.reload();
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PopoverSurface />
    <HintProvider>
      {/* The same page serves the quick quiz window (D76). */}
      <Boundary what="Ore" action={PHONE ? "Back to Today" : "Reload"} onBack={startOver}>
        {PHONE ? <PhoneApp /> : getCurrentWindow().label === "quiz" ? <QuickQuiz /> : <App />}
      </Boundary>
    </HintProvider>
  </StrictMode>,
);
