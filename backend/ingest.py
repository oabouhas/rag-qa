from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import os

def ingest_documents(docs_folder="docs/"):
    all_docs = []

    for filename in os.listdir(docs_folder):
        if filename.endswith(".pdf"):
            loader = PyPDFLoader(os.path.join(docs_folder, filename))
            all_docs.extend(loader.load())

    if not all_docs:
        print("No PDFs found in docs/ folder!")
        return

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(all_docs)
    print(f"Created {len(chunks)} chunks from {len(all_docs)} pages")

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    vectorstore = Chroma.from_documents(
        chunks, embeddings,
        persist_directory="vectorstore"
    )
    print("Vectorstore saved!")

if __name__ == "__main__":
    ingest_documents()