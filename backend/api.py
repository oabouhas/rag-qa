from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from groq import Groq
from dotenv import load_dotenv
import os
import shutil

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vectorstore = None
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

class QuestionRequest(BaseModel):
    question: str


@app.get("/")
def root():
    return {"status": "RAG API is running"}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vectorstore

    os.makedirs("docs", exist_ok=True)
    file_path = f"docs/{file.filename}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    loader = PyPDFLoader(file_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(docs)

    # Accumulate into existing vectorstore instead of wiping it
    if vectorstore is None and os.path.exists("vectorstore"):
        vectorstore = Chroma(
            persist_directory="vectorstore",
            embedding_function=embeddings
        )

    if vectorstore is None:
        vectorstore = Chroma.from_documents(
            chunks, embeddings,
            persist_directory="vectorstore"
        )
    else:
        vectorstore.add_documents(chunks)

    return {
        "message": f"Uploaded and indexed {len(chunks)} chunks from {file.filename}",
        "filename": file.filename
    }


@app.post("/reset")
def reset():
    global vectorstore
    vectorstore = None
    if os.path.exists("vectorstore"):
        shutil.rmtree("vectorstore")
    if os.path.exists("docs"):
        shutil.rmtree("docs")
    return {"message": "Vectorstore cleared"}


@app.post("/ask")
def ask_question(request: QuestionRequest):
    global vectorstore

    if vectorstore is None:
        if os.path.exists("vectorstore"):
            vectorstore = Chroma(
                persist_directory="vectorstore",
                embedding_function=embeddings
            )
        else:
            return {"error": "No document uploaded yet. Please upload a PDF first."}

    relevant_docs = vectorstore.similarity_search(request.question, k=3)

    context_parts = []
    sources = []
    chunks_used = []

    for doc in relevant_docs:
        context_parts.append(doc.page_content)
        sources.append(doc.metadata.get("source", "unknown"))
        chunks_used.append(doc.page_content)

    context = "\n\n".join(context_parts)
    sources = list(set(sources))

    prompt = f"""You are a helpful assistant. Answer the user's question 
using ONLY the context below. If the answer isn't in the context, 
say "I don't have enough information to answer that."

Context:
{context}

Question: {request.question}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": sources,
        "chunks": chunks_used
    }