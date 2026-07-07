# DocMind — AI Document Q&A

Upload any PDF and ask questions about it using AI. Built with a RAG (Retrieval-Augmented Generation) pipeline, FastAPI backend, and React frontend.

## Demo
> Upload a PDF → Ask questions → Get answers with source citations

## How it works
1. Upload a PDF — the document is split into chunks and embedded into a vector store
2. Ask a question — the most relevant chunks are retrieved using semantic search
3. Get an answer — a large language model answers using only your document as context

## Tech Stack
- **Frontend:** React.js
- **Backend:** FastAPI (Python)
- **Embeddings:** HuggingFace sentence-transformers
- **Vector Store:** ChromaDB
- **LLM:** Llama 3.3 70B via Groq API
- **RAG Framework:** LangChain
- **Evaluation & Experiment Tracking:** MLflow
- **Containerization:** Docker
- **CI/CD:** GitHub Actions

## Features
- Upload multiple PDFs — documents accumulate in the vector store
- Source citations — see which file the answer came from
- Source excerpts — expand to see the exact text chunks used
- Chat interface — clean conversational UI
- Clear & reset — wipe the session and start fresh

## Evaluation & Monitoring

This project includes an MLOps evaluation harness (`backend/eval.py`) that scores the RAG pipeline on a fixed test set across three dimensions:

- **Retrieval accuracy** — does the vector search return chunks from the correct source document?
- **Answer correctness** — does the generated answer contain the expected information?
- **Hallucination guarding** — when asked something outside the document set, does the system correctly refuse instead of making something up?

Results are logged to **MLflow** (params + metrics) so pipeline changes can be compared across runs over time, rather than eyeballing one-off terminal output.

Run it locally:
```bash
cd backend
python eval.py
mlflow ui   # then open http://localhost:5000 to view run history
```

**Diagnosed issue:** an early version of the vectorstore was silently missing 2 of 5 source documents due to stale persisted data being reused across ingestion runs. Diagnosed via a chunk-count audit script (`backend/debug_chunks.py`), fixed by rebuilding the vectorstore — retrieval accuracy improved from **60% → 100%**.

## Running with Docker

```bash
docker compose up --build
```

This builds and runs the backend in a container, exposing it on `http://localhost:8000`. Requires a `backend/.env` file with `GROQ_API_KEY` set (see Getting Started below).

## CI/CD

A GitHub Actions workflow (`.github/workflows/eval.yml`) runs the evaluation harness automatically on every push and pull request to `main`. The build fails if any metric drops below its required threshold (90% retrieval accuracy, 70% answer correctness, 100% hallucination guard pass rate), preventing regressions from being merged silently.

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key (free at console.groq.com)

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "GROQ_API_KEY=your_key_here" > .env
uvicorn api:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000 to use the app.
