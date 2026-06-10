"""
Backend Server für Video-Downloads mit yt-dlp
Stellt REST API für Frontend bereit
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import socket
import ipaddress
import tempfile
import logging
from pathlib import Path
from urllib.parse import urlparse
import uuid

app = Flask(__name__)

# CORS nur aktivieren, wenn explizit Origins konfiguriert sind.
# Im Normalbetrieb läuft das Frontend über den nginx-Proxy auf demselben
# Origin und braucht kein CORS.
_cors_origins = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
if _cors_origins:
    CORS(app, origins=_cors_origins)

# Logging konfigurieren
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Temporäres Verzeichnis für Downloads
TEMP_DIR = Path(tempfile.gettempdir()) / 'video_downloads'
TEMP_DIR.mkdir(exist_ok=True)

# Maximale Download-Größe (Schutz vor Disk-Füllung), konfigurierbar via Env
MAX_DOWNLOAD_SIZE = int(os.environ.get('MAX_DOWNLOAD_SIZE_BYTES', 2 * 1024 ** 3))  # Default: 2 GiB


def is_safe_url(url):
    """
    SSRF-Schutz: Lässt beliebige öffentliche http(s)-URLs zu, lehnt aber URLs ab,
    die (über DNS) auf interne/private Adressen zeigen. So funktionieren alle von
    yt-dlp unterstützten Seiten, ohne dass der Server als Proxy auf interne
    Dienste (localhost, Cloud-Metadaten, LAN) missbraucht werden kann.

    Restrisiko: Zwischen dieser Prüfung und yt-dlps eigener DNS-Auflösung kann ein
    bösartiger Nameserver die Antwort wechseln (DNS-Rebinding/TOCTOU). Für eine
    self-hosted Single-User-App ist das akzeptabel; echte Härtung wäre eine
    Netz-Isolation des Backend-Containers (kein Routing zu Host/LAN/Metadaten).
    """
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False

    if parsed.scheme not in ('http', 'https'):
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    # Alle Adressen auflösen; DNS-Fehler => ablehnen
    try:
        addrinfos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False
    if not addrinfos:
        return False

    # Ablehnen, wenn IRGENDEINE aufgelöste IP nicht öffentlich routbar ist
    for family, _type, _proto, _canon, sockaddr in addrinfos:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return False
        # IPv4-mapped IPv6 (z.B. ::ffff:127.0.0.1) vor Klassifizierung entpacken
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
            ip = ip.ipv4_mapped
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False

    return True


def clean_old_files():
    """Löscht alte temporäre Dateien (älter als 1 Stunde)"""
    try:
        import time
        now = time.time()
        for file in TEMP_DIR.glob('*'):
            if file.is_file() and now - file.stat().st_mtime > 3600:
                file.unlink()
                logger.info(f"Alte Datei gelöscht: {file.name}")
    except Exception as e:
        logger.error(f"Fehler beim Löschen alter Dateien: {e}")


def get_video_info(url):
    """
    Holt Video-Informationen mit yt-dlp
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            # Formatiere die verfügbaren Formate
            formats = []
            seen_resolutions = {}  # Speichere beste Formate pro Auflösung

            if 'formats' in info:
                for fmt in info['formats']:
                    # Nur Video-Formate (mit oder ohne Audio)
                    if fmt.get('vcodec') != 'none':
                        height = fmt.get('height')
                        quality = fmt.get('format_note', 'unknown')
                        ext = fmt.get('ext', 'mp4')
                        filesize = fmt.get('filesize') or fmt.get('filesize_approx', 0)
                        has_audio = fmt.get('acodec') != 'none'

                        # Erstelle Auflösungsstring
                        if height:
                            resolution = f"{height}p"
                        else:
                            resolution = fmt.get('resolution', 'unknown')

                        # Bevorzuge Formate mit Audio, sonst nehme höchste Bitrate
                        if resolution not in seen_resolutions:
                            seen_resolutions[resolution] = {
                                'format_id': fmt['format_id'],
                                'quality': quality,
                                'resolution': resolution,
                                'ext': ext,
                                'filesize': filesize,
                                'has_audio': has_audio,
                                'height': height or 0,
                                'vbr': fmt.get('vbr', 0) or 0
                            }
                        else:
                            # Aktualisiere wenn: (1) neues hat Audio und altes nicht, oder (2) beide gleich aber höhere Bitrate
                            existing = seen_resolutions[resolution]
                            if (has_audio and not existing['has_audio']) or \
                               (has_audio == existing['has_audio'] and
                                (fmt.get('vbr', 0) or 0) > existing['vbr']):
                                seen_resolutions[resolution] = {
                                    'format_id': fmt['format_id'],
                                    'quality': quality,
                                    'resolution': resolution,
                                    'ext': ext,
                                    'filesize': filesize,
                                    'has_audio': has_audio,
                                    'height': height or 0,
                                    'vbr': fmt.get('vbr', 0) or 0
                                }

                # Konvertiere Dictionary zu List
                formats = [
                    {k: v for k, v in fmt.items() if k not in ['vbr']}  # Entferne vbr vor Rückgabe
                    for fmt in seen_resolutions.values()
                ]

            # Sortiere nach Qualität (höchste zuerst)
            def extract_height(resolution):
                """Extrahiert die Höhe aus verschiedenen Auflösungsformaten"""
                if not resolution or resolution == 'unknown':
                    return 0
                try:
                    # Format 'widthxheight' (z.B. '1920x1080')
                    if 'x' in resolution:
                        return int(resolution.split('x')[-1])
                    # Format 'heightp' (z.B. '1080p')
                    return int(resolution.replace('p', ''))
                except (ValueError, AttributeError):
                    return 0

            formats.sort(key=lambda x: extract_height(x.get('resolution', '0p')), reverse=True)

            return {
                'is_playlist': False,
                'title': info.get('title', 'Unknown'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration'),
                'uploader': info.get('uploader'),
                'view_count': info.get('view_count'),
                'formats': formats[:10]  # Limitiere auf Top 10 Formate
            }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Video-Informationen: {e}")
        raise


def _entry_url(entry):
    """Ermittelt eine auflösbare URL für einen Playlist-Eintrag (flat extraction)"""
    if entry.get('url'):
        return entry['url']
    if entry.get('webpage_url'):
        return entry['webpage_url']
    # Fallback für flache YouTube-Einträge, die nur eine ID tragen
    if entry.get('ie_key') == 'Youtube' and entry.get('id'):
        return f"https://www.youtube.com/watch?v={entry['id']}"
    return None


def _format_playlist(info):
    """Baut die Playlist-Antwort aus einem yt-dlp extract_flat-Ergebnis"""
    entries = list(info.get('entries') or [])  # extract_flat liefert lazy entries
    formatted = []
    for entry in entries:
        if not entry:
            continue
        url = _entry_url(entry)
        if not url:
            continue
        thumbnail = entry.get('thumbnail')
        if not thumbnail and entry.get('thumbnails'):
            thumbnail = entry['thumbnails'][0].get('url')
        formatted.append({
            # url als Fallback-ID garantiert einen eindeutigen, nicht-leeren Key
            'id': entry.get('id') or url,
            'title': entry.get('title') or entry.get('id') or 'Unbekannt',
            'thumbnail': thumbnail,
            'duration': entry.get('duration'),
            'url': url,
        })

    return {
        'is_playlist': True,
        'title': info.get('title'),
        'uploader': info.get('uploader') or info.get('channel'),
        'entry_count': len(formatted),
        'entries': formatted,
    }


def get_url_info(url):
    """
    Untersucht eine URL mit flacher Extraktion. Ist es eine Playlist/ein Kanal,
    wird die Playlist-Antwort zurückgegeben. Bei einem einzelnen Video wird auf
    die volle Format-Extraktion (get_video_info) zurückgegriffen.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        'skip_download': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if info.get('_type') == 'playlist' or 'entries' in info:
        return _format_playlist(info)

    # Einzelvideo: volle Extraktion für die Formatliste
    return get_video_info(url)


def _build_format_opts(format_id, quality, output_template):
    """
    Erstellt die yt-dlp-Optionen für einen Download und gibt zusätzlich die
    erwartete Dateiendung zurück. Unterstützt entweder eine konkrete format_id
    (Einzelvideo-Auswahl) oder eine Qualitäts-Voreinstellung (Playlists).
    """
    opts = {
        'outtmpl': output_template,
        'quiet': False,
        'no_warnings': False,
        'max_filesize': MAX_DOWNLOAD_SIZE,
        # Verhindert, dass eine Watch-URL mit &list= versehentlich die ganze
        # Playlist in einem einzelnen Request herunterlädt
        'noplaylist': True,
    }

    if quality == 'audio':
        opts['format'] = 'bestaudio/best'
        opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]
        return opts, 'mp3'

    # Video: Qualitäts-Voreinstellung oder konkrete format_id
    if quality == '1080':
        fmt = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'
    elif quality == '720':
        fmt = 'bestvideo[height<=720]+bestaudio/best[height<=720]'
    elif quality == 'best':
        fmt = 'bestvideo+bestaudio/best'
    elif format_id:
        fmt = f'{format_id}+bestaudio/best'
    else:
        fmt = 'bestvideo+bestaudio/best'

    opts['format'] = fmt
    opts['merge_output_format'] = 'mp4'
    opts['postprocessors'] = [{
        'key': 'FFmpegVideoConvertor',
        'preferedformat': 'mp4',
    }]
    return opts, 'mp4'


def _find_output_file(file_id, expected_ext):
    """
    Findet die tatsächlich erzeugte Datei. Nach Postprocessing (mp3/mp4) stimmt
    prepare_filename nicht zwingend mit der Endung überein, daher wird zuerst die
    erwartete Endung geprüft und sonst nach {file_id}.* gesucht.
    """
    expected = TEMP_DIR / f"{file_id}.{expected_ext}"
    if expected.exists():
        return str(expected)
    matches = list(TEMP_DIR.glob(f"{file_id}.*"))
    return str(matches[0]) if matches else None


def download_video_file(url, format_id=None, quality=None):
    """
    Lädt ein Video herunter und gibt (Dateipfad, Titel, Endung) zurück.
    Falls das gewünschte Format nicht verfügbar ist, wird auf das beste
    verfügbare Format zurückgegriffen.
    """
    file_id = str(uuid.uuid4())
    output_template = str(TEMP_DIR / f"{file_id}.%(ext)s")

    ydl_opts, expected_ext = _build_format_opts(format_id, quality, output_template)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Starte Download: URL={url}, Format={format_id}, Qualität={quality}")
            info = ydl.extract_info(url, download=True)

            downloaded_file = _find_output_file(file_id, expected_ext)
            if downloaded_file:
                logger.info(f"Download erfolgreich: {downloaded_file}")
                return downloaded_file, info.get('title', 'video'), expected_ext
            raise Exception("Datei wurde nicht gefunden nach dem Download")

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        # Wenn das Format nicht verfügbar ist, versuche das beste verfügbare Format
        # (nur für Video-Downloads; Audio nutzt bereits bestaudio/best)
        if "Requested format is not available" in error_msg and expected_ext != 'mp3':
            logger.warning("Format nicht verfügbar, verwende bestes verfügbares Format")
            ydl_opts['format'] = 'best'
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    logger.info(f"Starte Download mit bestem Format: URL={url}")
                    info = ydl.extract_info(url, download=True)

                    downloaded_file = _find_output_file(file_id, expected_ext)
                    if downloaded_file:
                        logger.info(f"Download erfolgreich mit bestem Format: {downloaded_file}")
                        return downloaded_file, info.get('title', 'video'), expected_ext
                    raise Exception("Datei wurde nicht gefunden nach dem Download")
            except Exception as fallback_error:
                logger.error(f"Fehler beim Fallback-Download: {fallback_error}")
                raise
        else:
            logger.error(f"Fehler beim Download: {e}")
            raise
    except Exception as e:
        logger.error(f"Fehler beim Download: {e}")
        raise


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health Check Endpoint"""
    return jsonify({'status': 'ok', 'service': 'video-downloader-backend'}), 200


@app.route('/api/video-info', methods=['POST'])
def video_info():
    """
    Endpoint zum Abrufen von Video-Informationen
    """
    try:
        data = request.get_json()

        if not data or 'url' not in data:
            return jsonify({'error': 'URL fehlt'}), 400

        url = data['url']

        if not is_safe_url(url):
            logger.warning(f"Abgelehnte URL (ungültig oder interne Adresse): {url}")
            return jsonify({'error': 'URL ungültig oder zeigt auf eine nicht erlaubte (interne) Adresse.'}), 400

        logger.info(f"Video-Info angefordert für: {url}")

        # Bereinige alte Dateien
        clean_old_files()

        # Hole Informationen (erkennt automatisch Playlists vs. Einzelvideos)
        info = get_url_info(url)

        return jsonify(info), 200

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp Download-Fehler: {e}")
        return jsonify({'error': 'Video konnte nicht geladen werden. Bitte prüfe die URL.'}), 400
    except Exception as e:
        logger.error(f"Unerwarteter Fehler: {e}")
        return jsonify({'error': 'Interner Serverfehler'}), 500


@app.route('/api/playlist-info', methods=['POST'])
def playlist_info():
    """
    Endpoint zum Abrufen der Einträge einer Playlist/eines Kanals
    """
    try:
        data = request.get_json()

        if not data or 'url' not in data:
            return jsonify({'error': 'URL fehlt'}), 400

        url = data['url']

        if not is_safe_url(url):
            logger.warning(f"Abgelehnte URL (ungültig oder interne Adresse): {url}")
            return jsonify({'error': 'URL ungültig oder zeigt auf eine nicht erlaubte (interne) Adresse.'}), 400

        logger.info(f"Playlist-Info angefordert für: {url}")

        info = get_playlist_info(url)

        return jsonify(info), 200

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp Download-Fehler: {e}")
        return jsonify({'error': 'Playlist konnte nicht geladen werden. Bitte prüfe die URL.'}), 400
    except Exception as e:
        logger.error(f"Unerwarteter Fehler: {e}")
        return jsonify({'error': 'Interner Serverfehler'}), 500


@app.route('/api/download', methods=['POST'])
def download():
    """
    Endpoint zum Download von Videos
    """
    try:
        data = request.get_json()

        url = data.get('url') if data else None
        format_id = data.get('format_id') if data else None
        quality = data.get('quality') if data else None

        if not url or (not format_id and not quality):
            return jsonify({'error': 'URL und format_id oder quality erforderlich'}), 400

        if not is_safe_url(url):
            logger.warning(f"Abgelehnte URL (ungültig oder interne Adresse): {url}")
            return jsonify({'error': 'URL ungültig oder zeigt auf eine nicht erlaubte (interne) Adresse.'}), 400

        logger.info(f"Download angefordert: URL={url}, Format={format_id}, Qualität={quality}")

        # Download Video
        file_path, title, ext = download_video_file(url, format_id=format_id, quality=quality)

        # Sende Datei und lösche danach
        try:
            # Sanitize title für Dateinamen
            safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).rstrip()
            safe_title = safe_title[:100]  # Limitiere Länge

            filename = f"{safe_title}.{ext}"
            mimetype = 'audio/mpeg' if ext == 'mp3' else 'video/mp4'

            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename,
                mimetype=mimetype
            )
        finally:
            # Lösche Datei nach dem Senden
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Temporäre Datei gelöscht: {file_path}")
            except Exception as e:
                logger.error(f"Fehler beim Löschen der temporären Datei: {e}")

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp Download-Fehler: {e}")
        return jsonify({'error': 'Video konnte nicht heruntergeladen werden. Bitte prüfe die URL.'}), 400
    except Exception as e:
        logger.error(f"Unerwarteter Fehler beim Download: {e}")
        return jsonify({'error': 'Interner Serverfehler beim Download'}), 500


if __name__ == '__main__':
    logger.info("Starte Video-Downloader Backend Server...")
    app.run(host='0.0.0.0', port=8000, debug=False)
