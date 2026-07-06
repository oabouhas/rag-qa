"""Quick diagnostic: count how many chunks each source document contributed to the vectorstore."""
import os
from collections import Counter
from dotenv import load_dotenv
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory="vectorstore", embedding_function=embeddings)

data = vectorstore.get()
sources = [meta.get("source", "unknown") for meta in data["metadatas"]]
counts = Counter(sources)

print("Chunk count per source document:")
for source, count in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {count:4d} chunks  —  {source}")
print(f"\nTotal chunks: {sum(counts.values())}")