export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 40 }}>
      <h1>Relay</h1>
      <p>BYOK infrastructure SDK — proxy is at <code>/api/v1/chat/completions</code>.</p>
      <p style={{ marginTop: 16, display: "flex", gap: 16 }}>
        <a href="/docs" style={{ color: "#635bff", textDecoration: "none" }}>Docs →</a>
        <a href="/login" style={{ color: "#635bff", textDecoration: "none" }}>Console →</a>
      </p>
    </main>
  );
}
