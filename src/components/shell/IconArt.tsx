/** Shared ImageResponse artwork: coral tile with a white pulse line on the navy brand background. */
export function IconArt({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#060b16" }}>
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: inner * 0.28,
          background: "linear-gradient(135deg, #ff8a6b, #e04e2e)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 24 24">
          <path d="M3 12h4l2.5-6 5 12 2.5-6H21" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
