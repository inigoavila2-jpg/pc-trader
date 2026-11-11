import { lazy, Suspense, useState } from "react";

const ChatAssistant = lazy(() =>
  import("./chat/ChatAssistant.jsx").then((module) => ({ default: module.ChatAssistant }))
);

export function AIAgentChatbox(props) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const openAssistant = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setHasOpened(true);
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={openAssistant}
        aria-label="Open AI Assistant"
        style={{
          position: "fixed", bottom: "calc(78px + env(safe-area-inset-bottom))", right: 20,
          width: 56, height: 56, borderRadius: "50%", background: "#7c3aed", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, boxShadow: "0 8px 24px rgba(124,58,237,0.4)", zIndex: 4999,
          transition: "transform 0.2s, box-shadow 0.2s", transform: open ? "scale(1.1)" : "scale(1)",
        }}
        title="AI Assistant"
      >
        🤖
      </button>
      {hasOpened && (
        <Suspense fallback={open ? (
          <div role="status" style={{ position: "fixed", bottom: 16, right: 20, zIndex: 5001, color: "#fff" }}>
            Opening assistant…
          </div>
        ) : null}>
          <ChatAssistant {...props} open={open} setOpen={setOpen} />
        </Suspense>
      )}
    </>
  );
}
