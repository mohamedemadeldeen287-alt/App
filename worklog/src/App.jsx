import Today from "./screens/Today.jsx";

// Navigation items. Only "Today" is live in Step 1; the rest are placeholders
// for later steps so the adaptive nav chrome is visible early.
const NAV = [
  { key: "today", label: "Today", available: true },
  { key: "calendar", label: "Calendar", available: false },
  { key: "report", label: "Report", available: false },
];

function NavButton({ item, layout }) {
  const base =
    "flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition";
  const live =
    "text-accent-light dark:text-accent-dark bg-accent-light/10 dark:bg-accent-dark/15";
  const soon = "text-neutral-400 dark:text-neutral-600 cursor-not-allowed";
  const shape =
    layout === "sidebar"
      ? "w-full justify-start px-3 py-2"
      : "flex-1 flex-col px-2 py-1.5 text-xs gap-0.5 min-h-[52px]";
  return (
    <button
      disabled={!item.available}
      title={item.available ? undefined : "Coming in a later step"}
      className={`${base} ${shape} ${item.available ? live : soon}`}
    >
      {item.label}
      {!item.available && layout === "sidebar" && (
        <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
      )}
    </button>
  );
}

export default function App() {
  return (
    <div className="min-h-full bg-canvas-light font-sans text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 md:flex">
      {/* Desktop: sidebar nav */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral-200 p-4 dark:border-neutral-800 md:block">
        <div className="px-2 pb-4 text-lg font-semibold">Work Log</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton key={item.key} item={item} layout="sidebar" />
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1">
        <Today />
      </main>

      {/* Mobile: bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-neutral-200 bg-surface-light/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 md:hidden">
        {NAV.map((item) => (
          <NavButton key={item.key} item={item} layout="bottom" />
        ))}
      </nav>
    </div>
  );
}
