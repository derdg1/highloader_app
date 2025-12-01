"""
Backend Server für Video-Downloads mit yt-dlp
Stellt REST API für Frontend bereit
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import tempfile
import logging
from pathlib import Path
import uuid

app = Flask(__name__)
CORS(app)

# Logging konfigurieren
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Temporäres Verzeichnis für Downloads
TEMP_DIR = Path(tempfile.gettempdir()) / 'video_downloads'
TEMP_DIR.mkdir(exist_ok=True)


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
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],
                'player_skip': ['webpage', 'configs'],
            }
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            # Formatiere die verfügbaren Formate
            formats = []
            seen_qualities = set()

            if 'formats' in info:
                for fmt in info['formats']:
                    # Nur Video+Audio oder Video-only Formate
                    if fmt.get('vcodec') != 'none':
                        quality = fmt.get('format_note', 'unknown')
                        resolution = fmt.get('resolution', 'unknown')
                        ext = fmt.get('ext', 'mp4')
                        filesize = fmt.get('filesize') or fmt.get('filesize_approx', 0)

                        # Erstelle eindeutigen Qualitäts-String
                        quality_str = f"{resolution}-{quality}"

                        if quality_str not in seen_qualities:
                            seen_qualities.add(quality_str)
                            formats.append({
                                'format_id': fmt['format_id'],
                                'quality': quality,
                                'resolution': resolution,
                                'ext': ext,
                                'filesize': filesize,
                                'has_audio': fmt.get('acodec') != 'none'
                            })

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


def download_video_file(url, format_id):
    """
    Lädt Video herunter und gibt Dateipfad zurück
    Falls das gewünschte Format nicht verfügbar ist, wird das beste verfügbare Format verwendet
    """
    # Eindeutiger Dateiname
    file_id = str(uuid.uuid4())
    output_template = str(TEMP_DIR / f"{file_id}.%(ext)s")

    # Versuche zuerst mit dem gewünschten Format
    ydl_opts = {
        'format': format_id,
        'outtmpl': output_template,
        'quiet': False,
        'no_warnings': False,
        'merge_output_format': 'mp4',
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],
                'player_skip': ['webpage', 'configs'],
            }
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Starte Download: URL={url}, Format={format_id}")
            info = ydl.extract_info(url, download=True)

            # Finde die heruntergeladene Datei
            downloaded_file = ydl.prepare_filename(info)

            if os.path.exists(downloaded_file):
                logger.info(f"Download erfolgreich: {downloaded_file}")
                return downloaded_file, info.get('title', 'video')
            else:
                raise Exception("Datei wurde nicht gefunden nach dem Download")

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        # Wenn das Format nicht verfügbar ist, versuche mit 'best' Format
        if "Requested format is not available" in error_msg:
            logger.warning(f"Format {format_id} nicht verfügbar, verwende bestes verfügbares Format")
            ydl_opts['format'] = 'best'
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    logger.info(f"Starte Download mit bestem Format: URL={url}")
                    info = ydl.extract_info(url, download=True)

                    # Finde die heruntergeladene Datei
                    downloaded_file = ydl.prepare_filename(info)

                    if os.path.exists(downloaded_file):
                        logger.info(f"Download erfolgreich mit bestem Format: {downloaded_file}")
                        return downloaded_file, info.get('title', 'video')
                    else:
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
        logger.info(f"Video-Info angefordert für: {url}")

        # Bereinige alte Dateien
        clean_old_files()

        # Hole Video-Informationen
        info = get_video_info(url)

        return jsonify(info), 200

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp Download-Fehler: {e}")
        return jsonify({'error': f'Video konnte nicht geladen werden: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Unerwarteter Fehler: {e}")
        return jsonify({'error': f'Serverfehler: {str(e)}'}), 500


@app.route('/api/download', methods=['POST'])
def download():
    """
    Endpoint zum Download von Videos
    """
    try:
        data = request.get_json()

        if not data or 'url' not in data or 'format_id' not in data:
            return jsonify({'error': 'URL oder format_id fehlt'}), 400

        url = data['url']
        format_id = data['format_id']

        logger.info(f"Download angefordert: URL={url}, Format={format_id}")

        # Download Video
        file_path, title = download_video_file(url, format_id)

        # Sende Datei und lösche danach
        try:
            # Sanitize title für Dateinamen
            safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).rstrip()
            safe_title = safe_title[:100]  # Limitiere Länge

            filename = f"{safe_title}.mp4"

            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename,
                mimetype='video/mp4'
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
        return jsonify({'error': f'Video konnte nicht heruntergeladen werden: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Unerwarteter Fehler beim Download: {e}")
        return jsonify({'error': f'Download-Fehler: {str(e)}'}), 500


if __name__ == '__main__':
    logger.info("Starte Video-Downloader Backend Server...")
    app.run(host='0.0.0.0', port=8000, debug=False)
