FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:/app/apps/api
WORKDIR /app
COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /app/apps/api/requirements.txt
COPY . /app
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --app-dir /app/apps/api --host 0.0.0.0 --port ${PORT:-8080}"]
