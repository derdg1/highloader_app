# 📥 PWA Video Downloader

Eine Progressive Web App zum Herunterladen von Videos von YouTube, TikTok und Reddit - optimiert für iOS.

## ✨ Features

- 🎥 **Multi-Platform Support**: YouTube, TikTok, Reddit
- 📱 **iOS-optimiert**: Safe Area Support, Touch-optimiert, PWA-fähig
- 🌓 **Dark Mode**: Automatische Anpassung an System-Einstellungen
- 📊 **Qualitätsauswahl**: Wähle zwischen verschiedenen Videoqualitäten
- 📜 **Download-Historie**: Behalte den Überblick über deine Downloads
- ⚡ **Offline-Funktionalität**: Service Worker für bessere Performance
- 📲 **Installierbar**: Installiere die App auf deinem iOS-Homescreen

## 🚀 Installation

### Voraussetzungen

- Node.js 18+ und npm
- Ein Backend-Server mit yt-dlp (siehe Backend-Setup)

### Setup

1. **Repository klonen**:
   ```bash
   git clone <repository-url>
   cd highloader_app
   ```

2. **Dependencies installieren**:
   ```bash
   npm install
   ```

3. **Umgebungsvariablen konfigurieren**:
   ```bash
   cp .env.example .env
   ```

   Bearbeite `.env` und setze die Backend-URL:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

4. **Entwicklungsserver starten**:
   ```bash
   npm run dev
   ```

   Die App läuft dann auf `http://localhost:3000`

5. **Production Build erstellen**:
   ```bash
   npm run build
   ```

   Die optimierten Dateien befinden sich dann im `dist/` Verzeichnis.

## 📱 iOS Installation

### Als PWA installieren:

1. Öffne die App in Safari auf iOS
2. Tippe auf das Teilen-Symbol (□↑)
3. Scrolle runter und wähle "Zum Home-Bildschirm"
4. Tippe auf "Hinzufügen"

Die App verhält sich nun wie eine native App!

## 🔧 Backend Integration

Die App benötigt ein Backend mit folgenden Endpoints:

### POST `/api/video-info`
Gibt Video-Metadaten zurück.

**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response**:
```json
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": 300,
  "uploader": "Channel Name",
  "view_count": 1000000,
  "formats": [
    {
      "format_id": "22",
      "ext": "mp4",
      "height": 720,
      "filesize": 52428800
    }
  ]
}
```

### POST `/api/download`
Lädt das Video herunter.

**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format_id": "22"
}
```

**Response**: Video-Datei als Blob/Stream

### GET `/api/health` (Optional)
Health-Check Endpoint.

**Response**:
```json
{
  "status": "ok"
}
```

## 🛠️ Entwicklung

### Projektstruktur

```
highloader_app/
├── public/               # Statische Assets
│   ├── manifest.json    # PWA Manifest
│   ├── sw.js           # Service Worker
│   └── *.png           # Icons
├── src/
│   ├── components/      # React Komponenten
│   │   ├── VideoInput.jsx
│   │   ├── VideoPreview.jsx
│   │   ├── QualitySelector.jsx
│   │   ├── DownloadButton.jsx
│   │   └── DownloadHistory.jsx
│   ├── services/        # API Services
│   │   └── api.js
│   ├── styles/          # CSS Dateien
│   │   ├── index.css
│   │   ├── App.css
│   │   └── *.css
│   ├── App.jsx          # Haupt-App Komponente
│   └── main.jsx         # Entry Point
├── index.html
├── vite.config.js       # Vite + PWA Konfiguration
└── package.json
```

### Scripts

- `npm run dev` - Entwicklungsserver starten
- `npm run build` - Production Build erstellen
- `npm run preview` - Production Build lokal testen

## 🎨 Anpassungen

### Farben ändern

Bearbeite `/src/styles/index.css`:

```css
:root {
  --accent-color: #007aff;  /* Hauptfarbe */
  --bg-primary: #ffffff;     /* Hintergrund */
  /* ... */
}
```

### Icons anpassen

Ersetze die Placeholder-Icons in `/public/`:
- `pwa-192x192.png` (192x192px)
- `pwa-512x512.png` (512x512px)
- `apple-touch-icon.png` (180x180px)

Nutze Tools wie [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) zum Erstellen.

## 🔒 Sicherheit

- CORS muss auf dem Backend korrekt konfiguriert sein
- HTTPS wird für PWA-Features in Production empfohlen
- Keine sensiblen Daten im Frontend speichern

## 📝 Backend-Beispiel (Python/FastAPI)

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

app = FastAPI()

# CORS aktivieren
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Production einschränken!
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/video-info")
async def video_info(data: dict):
    url = data.get("url")

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

        return {
            "title": info.get("title"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
            "uploader": info.get("uploader"),
            "view_count": info.get("view_count"),
            "formats": [
                {
                    "format_id": f.get("format_id"),
                    "ext": f.get("ext"),
                    "height": f.get("height"),
                    "filesize": f.get("filesize"),
                }
                for f in info.get("formats", [])
                if f.get("vcodec") != "none"
            ]
        }

@app.post("/api/download")
async def download_video(data: dict):
    # Implementierung für Video-Download
    pass
```

## 🐛 Troubleshooting

### App lädt nicht
- Prüfe, ob das Backend läuft und erreichbar ist
- Prüfe die Console auf Fehler
- Prüfe die `VITE_API_BASE_URL` in der `.env`

### Videos werden nicht gefunden
- Prüfe, ob yt-dlp auf dem Backend aktuell ist
- Manche Plattformen blockieren Downloads

### PWA installiert sich nicht
- HTTPS ist für PWA in Production erforderlich
- Safari auf iOS benötigt die Apple-Meta-Tags

## 📄 Lizenz

MIT

## 🤝 Beitragen

Pull Requests sind willkommen! Für größere Änderungen bitte zuerst ein Issue öffnen.

---

**Hinweis**: Diese App ist nur für den persönlichen Gebrauch gedacht. Beachte die Nutzungsbedingungen der jeweiligen Plattformen.