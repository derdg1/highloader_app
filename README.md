# 📥 PWA Video Downloader

Progressive Web App zum Herunterladen von Videos von YouTube, TikTok und Reddit.

## Features

- 🎥 Multi-Platform: YouTube, TikTok, Reddit
- 📱 iOS-optimiert mit PWA-Support
- 🌓 Dark Mode
- 📊 Qualitätsauswahl
- 📜 Download-Historie
- ⚡ Offline-fähig
- 📲 Installierbar auf iOS

## Quick Start

```bash
# Mit Docker (Port 8888)
docker compose up -d

# Oder lokal
npm install
npm run dev
```

## Deployment

Das Image ist verfügbar auf GitHub Container Registry:
```bash
docker pull ghcr.io/<username>/highloader_app:latest
```

**Hinweis**: Benötigt ein Backend mit yt-dlp für Video-Downloads.
