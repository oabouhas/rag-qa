import { useState, useRef, useEffect } from "react";
import axios from "axios";

function App() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [expandedChunks, setExpandedChunks] = useState({});
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const uploadPDF = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await axios.post("http://127.0.0.1:8000/upload", formData);
        setUploadedFiles((prev) => [...prev, file.name]);
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `"${file.name}" uploaded successfully!` },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: `Failed to upload "${file.name}". Please try again.` },
        ]);
      }
    }
    setUploading(false);
  };

  const askQuestion = async (q) => {
    const text = q || question;
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/ask", { question: text });
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: res.data.answer,
          sources: res.data.sources,
          chunks: res.data.chunks,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    await axios.post("http://127.0.0.1:8000/reset");
    setMessages([]);
    setUploadedFiles([]);
    setExpandedChunks({});
  };

  const toggleChunk = (msgIndex, chunkIndex) => {
    const key = `${msgIndex}-${chunkIndex}`;
    setExpandedChunks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>◈</span>
            <span style={styles.logoText}>DocMind</span>
          </div>
          <p style={styles.tagline}>Ask anything about your documents</p>

          <label style={{ ...styles.uploadBtn, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Uploading..." : "+ Upload PDF"}
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={uploadPDF}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>

          {uploadedFiles.length > 0 && (
            <div style={styles.fileList}>
              <p style={styles.fileListTitle}>Uploaded files</p>
              {uploadedFiles.map((name, i) => (
                <div key={i} style={styles.fileItem}>
                  <span style={styles.fileIcon}>📄</span>
                  <span style={styles.fileName}>{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <button onClick={clearChat} style={styles.clearBtn}>
            Clear chat & reset
          </button>
        )}
      </div>

      {/* Main */}
      <div style={styles.main}>
        <div style={styles.chatBox}>
          {messages.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>◈</div>
              <h2 style={styles.emptyTitle}>Upload a PDF to get started</h2>
              <p style={styles.emptySubtitle}>
                Upload one or more PDFs on the left, then ask any question about them.
              </p>
              <div style={styles.exampleGrid}>
                {[
                  "What are the main topics?",
                  "Summarize this document",
                  "What are the key findings?",
                  "Who are the main people mentioned?",
                ].map((ex, i) => (
                  <div
                    key={i}
                    style={styles.exampleChip}
                    onClick={() => uploadedFiles.length > 0 && askQuestion(ex)}
                  >
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={
                  msg.role === "user"
                    ? styles.userRow
                    : styles.botRow
                }
              >
                {msg.role !== "user" && (
                  <div style={styles.avatar}>
                    {msg.role === "system" ? "✓" : msg.role === "error" ? "!" : "◈"}
                  </div>
                )}
                <div style={{ maxWidth: "70%", width: "fit-content" }}>
                  <div
                    style={
                      msg.role === "user"
                        ? styles.userBubble
                        : msg.role === "system"
                        ? styles.systemBubble
                        : msg.role === "error"
                        ? styles.errorBubble
                        : styles.botBubble
                    }
                  >
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{msg.text}</p>
                    {msg.sources?.length > 0 && (
                      <p style={styles.source}>📎 {msg.sources.join(", ")}</p>
                    )}
                  </div>

                  {/* Source chunks */}
                  {msg.chunks?.length > 0 && (
                    <div style={styles.chunksContainer}>
                      <p style={styles.chunksLabel}>Source excerpts</p>
                      {msg.chunks.map((chunk, ci) => {
                        const key = `${i}-${ci}`;
                        const expanded = expandedChunks[key];
                        return (
                          <div key={ci} style={styles.chunkBox}>
                            <p style={styles.chunkText}>
                              {expanded ? chunk : chunk.slice(0, 120) + (chunk.length > 120 ? "..." : "")}
                            </p>
                            {chunk.length > 120 && (
                              <button
                                onClick={() => toggleChunk(i, ci)}
                                style={styles.chunkToggle}
                              >
                                {expanded ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div style={styles.botRow}>
              <div style={styles.avatar}>◈</div>
              <div style={styles.botBubble}>
                <div style={styles.dotsContainer}>
                  <span style={{ ...styles.dot, animationDelay: "0s" }} />
                  <span style={{ ...styles.dot, animationDelay: "0.2s" }} />
                  <span style={{ ...styles.dot, animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={styles.inputArea}>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              type="text"
              placeholder={
                uploadedFiles.length === 0
                  ? "Upload a PDF first..."
                  : "Ask a question about your documents..."
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askQuestion()}
              disabled={uploadedFiles.length === 0 || loading}
            />
            <button
              style={{
                ...styles.sendBtn,
                opacity: uploadedFiles.length === 0 || loading ? 0.4 : 1,
              }}
              onClick={() => askQuestion()}
              disabled={uploadedFiles.length === 0 || loading}
            >
              ↑
            </button>
          </div>
          <p style={styles.hint}>Press Enter or click ↑ to send</p>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @media (max-width: 640px) {
          .sidebar { display: none !important; }
          .chatBox { padding: 20px 16px !important; }
          .inputArea { padding: 12px 16px 20px !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    height: "100vh",
    background: "#f7f7f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  sidebar: {
    width: 260,
    background: "#1a1a1a",
    padding: "28px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  logoIcon: { fontSize: 22, color: "#fff" },
  logoText: { fontSize: 18, fontWeight: 600, color: "#fff" },
  tagline: { fontSize: 12, color: "#666", marginBottom: 24, lineHeight: 1.5 },
  uploadBtn: {
    display: "block",
    padding: "10px 16px",
    background: "#2a2a2a",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    border: "1px solid #333",
    textAlign: "center",
    marginBottom: 20,
  },
  fileList: { marginTop: 8 },
  fileListTitle: {
    fontSize: 11,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    borderBottom: "1px solid #222",
  },
  fileIcon: { fontSize: 14 },
  fileName: {
    fontSize: 12,
    color: "#aaa",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  clearBtn: {
    background: "transparent",
    border: "1px solid #333",
    color: "#666",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 12,
    width: "100%",
  },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  chatBox: { flex: 1, overflowY: "auto", padding: "40px 60px" },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    textAlign: "center",
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, color: "#ccc" },
  emptyTitle: { fontSize: 22, fontWeight: 600, color: "#1a1a1a", margin: "0 0 8px" },
  emptySubtitle: { fontSize: 14, color: "#888", marginBottom: 32, maxWidth: 400 },
  exampleGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    width: "100%",
    maxWidth: 480,
  },
  exampleChip: {
    padding: "12px 16px",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    fontSize: 13,
    color: "#444",
    cursor: "pointer",
    textAlign: "left",
  },
  userRow: { display: "flex", justifyContent: "flex-end", marginBottom: 16 },
  botRow: { display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#1a1a1a",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  userBubble: {
    background: "#1a1a1a",
    color: "#fff",
    borderRadius: "18px 18px 4px 18px",
    padding: "12px 16px",
    fontSize: 14,
  },
  botBubble: {
    background: "#fff",
    color: "#1a1a1a",
    borderRadius: "4px 18px 18px 18px",
    padding: "12px 16px",
    fontSize: 14,
    border: "1px solid #eee",
  },
  systemBubble: {
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: "4px 18px 18px 18px",
    padding: "10px 14px",
    fontSize: 13,
    border: "1px solid #bbf7d0",
  },
  errorBubble: {
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: "4px 18px 18px 18px",
    padding: "10px 14px",
    fontSize: 13,
    border: "1px solid #fecaca",
  },
  source: { fontSize: 11, color: "#999", marginTop: 8, marginBottom: 0 },
  chunksContainer: { marginTop: 8 },
  chunksLabel: {
    fontSize: 11,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chunkBox: {
    background: "#f9f9f9",
    border: "1px solid #eee",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 6,
  },
  chunkText: { fontSize: 12, color: "#555", margin: "0 0 4px", lineHeight: 1.5 },
  chunkToggle: {
    background: "none",
    border: "none",
    color: "#999",
    fontSize: 11,
    cursor: "pointer",
    padding: 0,
  },
  dotsContainer: { display: "flex", gap: 4, alignItems: "center", height: 20 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#999",
    display: "inline-block",
    animation: "bounce 1.2s ease-in-out infinite",
  },
  inputArea: { padding: "16px 60px 24px", background: "#f7f7f5", borderTop: "1px solid #eee" },
  inputRow: { display: "flex", gap: 10 },
  input: {
    flex: 1,
    padding: "14px 18px",
    borderRadius: 12,
    border: "1px solid #e5e5e5",
    fontSize: 14,
    background: "#fff",
    outline: "none",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 20,
  },
  hint: { fontSize: 11, color: "#bbb", marginTop: 8, textAlign: "center" },
};

export default App;