import Link from "next/link";

export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        alignContent: "center",
        gap: 18,
        padding: 24,
        background: "#070b14",
        color: "#c9a24b",
        fontFamily: "var(--font-cinzel), Georgia, serif",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(1.35rem, 4vw, 2.5rem)",
          fontWeight: 400,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h1>
      <Link href="/" style={{ color: "#efd79a", letterSpacing: "0.08em" }}>
        ← Back to navigation
      </Link>
    </main>
  );
}
