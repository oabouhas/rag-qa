FROM python:3.11-slim

WORKDIR /app

# System deps needed by chromadb / sentence-transformers at build time
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first, in its own layer, from PyTorch's CPU wheel index.
# Doing this separately (not in requirements.txt) avoids pip pulling the much larger
# CUDA/GPU build, which isn't needed for this app and would bloat the image by ~2GB+.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]