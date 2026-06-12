FROM python:3.11-slim

WORKDIR /app

# Installiere System-Abhängigkeiten für yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Kopiere Requirements und installiere Python-Pakete
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiere Anwendungscode
COPY app.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Unprivilegierter User für den App-Prozess
RUN useradd --system --create-home --uid 1000 appuser

# Verzeichnisse für temporäre Downloads und persistente Cookies anlegen
RUN mkdir -p /tmp/video_downloads /data \
    && chown appuser:appuser /tmp/video_downloads /data

USER appuser

# Exponiere Port
EXPOSE 8000

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8000/api/health || exit 1

# Starte mit Gunicorn für Production (Entrypoint aktualisiert vorher yt-dlp)
CMD ["./entrypoint.sh"]
