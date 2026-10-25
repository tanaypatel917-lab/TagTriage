/** Shared ImageResponse artwork: signal-red sticker tile with an ink border and a paper medical cross. */
export function IconArt({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size - padding * 2;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3eee4" }}>
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: inner * 0.22,
          background: "#d7261e",
          border: `${Math.max(1, inner * 0.045)}px solid #0f1a2a`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg width={inner * 0.66} height={inner * 0.66} viewBox="0 0 32 32">
          <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fbf8f2" stroke="#0f1a2a" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
