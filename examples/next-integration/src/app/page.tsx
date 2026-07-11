import Link from "next/link"

export default function Home() {
  return (
    <div>
      <section style={{
        textAlign: "center",
        padding: "64px 0",
      }}>
        <h2 style={{ fontSize: "36px", fontWeight: 700, margin: "0 0 16px" }}>
          APICraft + Next.js Integration
        </h2>
        <p style={{ fontSize: "18px", color: "#64748b", maxWidth: "600px", margin: "0 auto 32px" }}>
          This example demonstrates how APICraft integrates with Next.js App Router.
          Define your API once using decorators — route handlers are auto-generated.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <Link href="/posts"
            style={{
              padding: "12px 24px",
              backgroundColor: "#3b82f6",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
            }}>
            View Posts
          </Link>
        </div>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "24px",
        marginTop: "32px",
      }}>
        {[
          {
            title: "API Definition",
            desc: "Define your API using @api, @get, @post decorators with Zod validation.",
          },
          {
            title: "Route Generation",
            desc: "Route handlers are generated for Next.js App Router automatically.",
          },
          {
            title: "OpenAPI Spec",
            desc: "OpenAPI 3.1 spec is auto-generated from your decorator definitions.",
          },
        ].map((card) => (
          <div key={card.title} style={{
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>{card.title}</h3>
            <p style={{ margin: 0, color: "#64748b", lineHeight: "1.6" }}>{card.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
