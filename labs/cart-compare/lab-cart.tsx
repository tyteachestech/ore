// The code version of the cart ending, alone: the app's own end screen (EndScreen from Review.tsx) on a made-up
// session that lights the ring's last 12 dots (as the Rive build pours 12) and cuts a gem, with the mole asleep on the cart (the nap ending, as the Rive build plays).
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { createRoot } from "react-dom/client";
import { HintProvider } from "./Hint";
import { EndScreen } from "./Review";
import "./styles.css";
import "./retro.css";
import "./tailwind.css";
import "./frames-probe";

const today = (met: boolean, active_ms: number) => ({ goal_minutes: 10, goal_ms: 600_000, active_ms, met, counts: true, caught_up: false, new_waiting: 0, skills: [] });
const end = { session: { id: "s", reviews: 12, kept: 11, rescued: 0, cut: ["ai"] }, today: today(true, 600_000), before: today(false, 360_000), next: null } as never;
const skills = [{ id: "ai", name: "AI", color: "purple", icon: "ai" }] as never;

// The roll that picks the nap ending (D255) and the mole's first line, only while it mounts.
const random = Math.random;
Math.random = () => 0.01;
createRoot(document.getElementById("root")!).render(
  <HintProvider><TooltipProvider><EndScreen end={end} skills={skills} onDone={() => {}} onAgain={() => {}} onTry={() => {}} /></TooltipProvider></HintProvider>,
);
requestAnimationFrame(() => requestAnimationFrame(() => ((Math.random = random), dispatchEvent(new Event("cart-start")))));
