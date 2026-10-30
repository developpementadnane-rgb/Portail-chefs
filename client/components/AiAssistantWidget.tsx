import { useEffect } from "react";

const IMFA_SCRIPT_SRC = "https://www.imfa.app/embed/chatbot/loader.js";
const IMFA_CHATBOT_ID = "9ad4q4mb";

/**
 * Mounts the SHM AI assistant widget (configured on imfa.app's
 * platform — branding, knowledge base, and behavior are set up there,
 * not in this codebase). Replaces the old LoginHelpWidget, which was
 * a hardcoded FAQ button with no real chat logic: any free-text
 * message always returned the same canned "contact
 * shm@example.com" reply regardless of what was typed, which is the
 * "ne fonctionne pratiquement pas" behavior this component removes.
 *
 * Mounted once at the app root (see App.tsx), not per-page, so the
 * assistant is available everywhere rather than only on /login.
 *
 * Note for anyone auditing this: this loader script is a third-party
 * integration — messages sent through the resulting widget are
 * processed on imfa.app's servers, not this app's own Supabase
 * backend. It renders its own floating bubble UI; nothing else in
 * this component controls its appearance beyond the data-chatbot ID,
 * which is configured (logo, colors, greeting) on the imfa.app
 * dashboard for that ID.
 */
export default function AiAssistantWidget() {
  useEffect(() => {
    // Guard against double-injection: React StrictMode double-invokes
    // effects in development, and this component could in principle
    // be mounted more than once — without this check that would load
    // the loader script (and therefore render the bubble) twice.
    if (document.querySelector(`script[data-chatbot="${IMFA_CHATBOT_ID}"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.src = IMFA_SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-chatbot", IMFA_CHATBOT_ID);
    document.body.appendChild(script);

    // Deliberately not removed on unmount: this component is mounted
    // once for the lifetime of the app (see App.tsx) and the widget
    // script manages its own bubble/panel DOM after loading — tearing
    // it down on a route change would just cause it to reload
    // needlessly on every navigation.
  }, []);

  return null;
}
