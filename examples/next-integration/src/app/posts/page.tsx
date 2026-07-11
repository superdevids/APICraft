"use client"

import { useEffect, useState } from "react"
import type { Post } from "../../apis/posts.js"

interface PostsResponse {
  data: Post[]
  meta: { total: number; page: number; limit: number }
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/posts?published=true")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch posts")
        return res.json() as Promise<PostsResponse>
      })
      .then((data) => {
        setPosts(data.data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0", color: "#64748b" }}>
        Loading posts...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0", color: "#ef4444" }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
      }}>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>Posts</h2>
        <span style={{ color: "#64748b", fontSize: "14px" }}>
          {posts.length} post{posts.length !== 1 ? "s" : ""} published
        </span>
      </div>

      {posts.length === 0 ? (
        <p style={{ textAlign: "center", color: "#94a3b8", padding: "48px 0" }}>
          No posts yet. Create one via the API.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {posts.map((post) => (
            <article key={post.id} style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>
                {post.title}
              </h3>
              <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: "1.6" }}>
                {post.content}
              </p>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
                color: "#94a3b8",
              }}>
                <span>By {post.author}</span>
                <span>{new Date(post.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
