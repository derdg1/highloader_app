# 📥 PWA Video Downloader

Progressive Web App zum Herunterladen von Videos von YouTube, TikTok und Reddit mit vollständigem Backend.

## Features

- 🎥 Multi-Platform: YouTube, TikTok, Reddit
- 📱 iOS-optimiert mit PWA-Support
- 🌓 Dark Mode
- 📊 Qualitätsauswahl mit mehreren Formaten
- 📜 Download-Historie
- ⚡ Offline-fähig (PWA)
- 📲 Installierbar auf iOS/Android
- 🔧 Komplettes Backend mit yt-dlp
- 🐳 Docker-ready für einfaches Deployment

## Architektur

Die App besteht aus zwei Services:

1. **Frontend** (React PWA + Nginx)
   - React-basierte Progressive Web App
   - Nginx als Webserver und Reverse Proxy
   - Port: 8888

2. **Backend** (Python + Flask + yt-dlp)
   - REST API für Video-Downloads
   - Automatische Format-Erkennung
   - Temporäres Caching

## Quick Start

### Mit Docker Compose (Empfohlen)

```bash
# Starte beide Services
docker compose up -d

# Prüfe Status
docker compose ps

# Logs ansehen
docker compose logs -f

# Stoppen
docker compose down
```

Die App ist dann verfügbar unter: `http://localhost:8888`

### Lokal entwickeln

**Frontend:**
```bash
npm install
npm run dev
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

## Deployment

### Portainer Stack

1. Logge dich in Portainer ein
2. Navigiere zu **Stacks** → **Add stack**
3. Name: `video-downloader`
4. Kopiere den Inhalt von `docker-compose.yml`
5. Setze Environment Variable:
   - `GITHUB_REPOSITORY_OWNER=derdg1` (oder dein Username)
6. Deploy stack
7. App ist verfügbar unter: `http://your-server:8888`

### Docker Images

Die Images werden automatisch gebaut via GitHub Actions:

```bash
# Frontend
docker pull ghcr.io/derdg1/highloader_app:latest

# Backend
docker pull ghcr.io/derdg1/highloader_app-backend:latest
```

### Manuelle Docker Build

```bash
# Frontend
docker build -t highloader-frontend .

# Backend
docker build -t highloader-backend ./backend
```

## Konfiguration

### Environment Variables

**Backend:**
- `PYTHONUNBUFFERED=1` - Für besseres Logging

**Frontend:**
- `NODE_ENV=production` - Production Mode

### Nginx Reverse Proxy

Alle `/api/*` Requests werden automatisch zum Backend weitergeleitet:
- `/api/health` → Backend Health Check
- `/api/video-info` → Video-Informationen abrufen
- `/api/download` → Video herunterladen

## API Endpoints

### GET /api/health
Health Check für Backend

**Response:**
```json
{
  "status": "ok",
  "service": "video-downloader-backend"
}
```

### POST /api/video-info
Ruft Video-Informationen ab

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**
```json
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": 300,
  "uploader": "Channel Name",
  "view_count": 1000000,
  "formats": [
    {
      "format_id": "137",
      "quality": "1080p",
      "resolution": "1920x1080",
      "ext": "mp4",
      "filesize": 50000000,
      "has_audio": true
    }
  ]
}
```

### POST /api/download
Lädt Video herunter

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format_id": "137"
}
```

**Response:**
Video-Datei als Download (Content-Type: video/mp4)

## Troubleshooting

### Download funktioniert nicht

1. **Backend Status prüfen:**
   ```bash
   docker compose logs backend
   ```

2. **Health Check:**
   ```bash
   curl http://localhost:8888/api/health
   ```

3. **Ports prüfen:**
   ```bash
   docker compose ps
   ```

### Fehler: "Backend nicht erreichbar"

- Stelle sicher, dass beide Container laufen
- Prüfe die Netzwerk-Verbindung zwischen Frontend und Backend
- Überprüfe die Logs: `docker compose logs -f`

### Fehler beim Video-Download

- Manche Videos sind geo-blocked oder haben Einschränkungen
- Prüfe ob die URL korrekt ist
- Einige private oder altersbeschränkte Videos funktionieren nicht

## Updates

Die App aktualisiert sich automatisch via Watchtower bei neuen Releases:

```bash
# Manuell aktualisieren
docker compose pull
docker compose up -d
```

## Technologie-Stack

- **Frontend:** React 18, Vite, TailwindCSS
- **Backend:** Python 3.11, Flask, yt-dlp
- **Server:** Nginx
- **Container:** Docker, Docker Compose
- **CI/CD:** GitHub Actions
- **Registry:** GitHub Container Registry
