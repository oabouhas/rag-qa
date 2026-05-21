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

## Features
- Upload multiple PDFs — documents accumulate in the vector store
- Source citations — see which file the answer came from
- Source excerpts — expand to see the exact text chunks used
- Chat interface — clean conversational UI
- Clear & reset — wipe the session and start fresh

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