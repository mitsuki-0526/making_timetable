import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    __TIMETABLE_DISABLE_WINDOW_ZOOM__?: boolean;
  }
}

function installWindowZoomGuard() {
  if (window.__TIMETABLE_DISABLE_WINDOW_ZOOM__) {
    return;
  }

  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  };

  const handleGesture: EventListener = (event) => {
    event.preventDefault();
  };

  window.addEventListener("wheel", handleWheel, { passive: false });

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(eventName, handleGesture, { passive: false });
  }

  window.__TIMETABLE_DISABLE_WINDOW_ZOOM__ = true;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("root element not found");
}

installWindowZoomGuard();

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
