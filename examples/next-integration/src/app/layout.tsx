import type { ReactNode } from "react"
import "./globals.css"

export const metadata = {
  title: "APICraft Next.js Example",
  description: "A Next.js app integrated with APICraft",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        margin: 0,
        padding: 0,
        backgroundColor: "#f8fafc",
        color: "#1e293b",
      }}>
        <header style={{
          backgroundColor: "#1e293b",
          color: "white",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>
            APICraft + Next.js
          </h1>
          <nav style={{ display: "flex", gap: "16px" }}>
            <a href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>Home</a>
            <a href="/posts" style={{ color: "#94a3b8", textDecoration: "none" }}>Posts</a>
          </nav>
        </header>
        <main style={{ maxWidth: "960px", margin: "0 auto", padding: "32px" }}>
          {children}
        </main>
      </body>
    </html>
  )
}
