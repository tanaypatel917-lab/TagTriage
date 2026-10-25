export const NAV = [
  { href: "/", label: "Capture" },
  { href: "/register", label: "Register" },
  { href: "/board", label: "Board" },
  { href: "/inventory", label: "Inventory" },
  { href: "/audit", label: "Audit·Sync" }
];

export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="4.5" y="4.5" width="33" height="33" rx="8" fill="#0f1a2a" />
      <rect x="1.5" y="1.5" width="33" height="33" rx="8" fill="#d7261e" stroke="#0f1a2a" strokeWidth="2" />
      <path d="M15 8.5h6v6.5h6.5v6H21v6.5h-6V21H8.5v-6H15z" fill="#fbf8f2" stroke="#0f1a2a" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
