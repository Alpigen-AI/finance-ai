# Cloud Run deployment image for the FastAPI backend + Google ADK agents.
# Cloud Run injects $PORT — uvicorn must bind to it, not a hardcoded port.
FROM python:3.12-slim

WORKDIR /app

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend needs the services/ package (agents, tax rules, financial engine)
# alongside the api app itself.
COPY apps/api/app ./app
COPY services ./services

ENV PORT=8080
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
