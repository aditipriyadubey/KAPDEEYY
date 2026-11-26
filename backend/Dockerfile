# KAPDEEYY backend (FastAPI).
#
# SQLite and uploaded images must live on a mounted persistent volume. This
# image deliberately contains no data and no .env: set SQLITE_PATH and
# UPLOADS_PATH to paths inside the mounted volume (e.g. /data).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SQLITE_PATH=/data/kapdeeyy.db \
    UPLOADS_PATH=/data/uploads

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /data/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
