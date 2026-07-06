"""
DocMind Evaluation Harness
--------------------------
Scores the RAG pipeline on a fixed test set across three dimensions:
  1. Retrieval accuracy   - did we retrieve a chunk from the expected source doc?
  2. Answer correctness   - does the generated answer contain the expected keywords?
  3. Hallucination guard  - for out-of-scope questions, does the model correctly refuse
                            instead of making something up?

Results are logged to MLflow (local file store, ./mlruns) so runs can be compared
over time as the pipeline changes (chunk size, k, model, prompt, etc).

Usage:
    python eval.py
    mlflow ui   # then open http://localhost:5000 to view run history
"""

import json
import os
import time

import mlflow
from dotenv import load_dotenv
from groq import Groq
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ModuleNotFoundError:
    from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K = 3
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
LLM_MODEL = "llama-3.3-70b-versatile"
DOCS_DIR = "docs"
VECTORSTORE_DIR = "vectorstore"
REFUSAL_PHRASE = "don't have enough information"


def build_or_load_vectorstore(embeddings):
    """Reuse the persisted vectorstore if present, otherwise ingest docs/ from scratch."""
    if os.path.exists(VECTORSTORE_DIR):
        return Chroma(persist_directory=VECTORSTORE_DIR, embedding_function=embeddings)

    all_docs = []
    for filename in os.listdir(DOCS_DIR):
        if filename.endswith(".pdf"):
            loader = PyPDFLoader(os.path.join(DOCS_DIR, filename))
            all_docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks = splitter.split_documents(all_docs)
    return Chroma.from_documents(chunks, embeddings, persist_directory=VECTORSTORE_DIR)


def ask(vectorstore, client, question):
    start = time.time()

    relevant_docs = vectorstore.similarity_search(question, k=TOP_K)
    sources = list({doc.metadata.get("source", "unknown") for doc in relevant_docs})
    context = "\n\n".join(doc.page_content for doc in relevant_docs)

    prompt = f"""You are a helpful assistant. Answer the user's question
using ONLY the context below. If the answer isn't in the context,
say "I don't have enough information to answer that."

Context:
{context}

Question: {question}"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
    )
    answer = response.choices[0].message.content
    latency = time.time() - start
    return answer, sources, latency


def score_case(case, answer, sources):
    result = {"id": case["id"], "question": case["question"], "answer": answer, "retrieved_sources": sources}

    if case.get("expect_refusal"):
        result["retrieval_hit"] = None
        result["keyword_hit"] = REFUSAL_PHRASE.lower() in answer.lower()
        result["check_type"] = "hallucination_guard"
        return result

    expected_source = case["expected_source_contains"]
    result["retrieval_hit"] = any(expected_source.lower() in s.lower() for s in sources)

    keywords = case["expected_keywords"]
    result["keyword_hit"] = any(kw.lower() in answer.lower() for kw in keywords)
    result["check_type"] = "grounded_qa"
    return result


def run_eval():
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    vectorstore = build_or_load_vectorstore(embeddings)

    with open("eval_dataset.json") as f:
        cases = json.load(f)

    results = []
    latencies = []
    for case in cases:
        answer, sources, latency = ask(vectorstore, client, case["question"])
        result = score_case(case, answer, sources)
        result["latency_sec"] = round(latency, 2)
        latencies.append(latency)
        results.append(result)

    grounded = [r for r in results if r["check_type"] == "grounded_qa"]
    guard = [r for r in results if r["check_type"] == "hallucination_guard"]

    retrieval_hit_rate = sum(r["retrieval_hit"] for r in grounded) / len(grounded)
    keyword_hit_rate = sum(r["keyword_hit"] for r in grounded) / len(grounded)
    hallucination_guard_pass_rate = (
        sum(r["keyword_hit"] for r in guard) / len(guard) if guard else None
    )
    avg_latency = sum(latencies) / len(latencies)

    with mlflow.start_run():
        mlflow.log_param("chunk_size", CHUNK_SIZE)
        mlflow.log_param("chunk_overlap", CHUNK_OVERLAP)
        mlflow.log_param("top_k", TOP_K)
        mlflow.log_param("embedding_model", EMBEDDING_MODEL)
        mlflow.log_param("llm_model", LLM_MODEL)

        mlflow.log_metric("retrieval_hit_rate", retrieval_hit_rate)
        mlflow.log_metric("keyword_hit_rate", keyword_hit_rate)
        if hallucination_guard_pass_rate is not None:
            mlflow.log_metric("hallucination_guard_pass_rate", hallucination_guard_pass_rate)
        mlflow.log_metric("avg_latency_sec", avg_latency)

        with open("eval_results.json", "w") as f:
            json.dump(results, f, indent=2)
        mlflow.log_artifact("eval_results.json")

    print("\n=== DocMind Eval Report ===")
    print(f"Retrieval hit rate:          {retrieval_hit_rate:.0%}")
    print(f"Answer keyword hit rate:     {keyword_hit_rate:.0%}")
    if hallucination_guard_pass_rate is not None:
        print(f"Hallucination guard pass:   {hallucination_guard_pass_rate:.0%}")
    print(f"Avg latency:                 {avg_latency:.2f}s")
    print("\nPer-question detail:")
    for r in results:
        flag = "✅" if r.get("keyword_hit") else "❌"
        print(f"  {flag} [{r['id']}] {r['question']}")
    print("\nRun `mlflow ui` and open http://localhost:5000 to see this run logged over time.")


if __name__ == "__main__":
    run_eval()