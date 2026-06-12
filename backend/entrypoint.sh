#!/bin/sh
# yt-dlp beim Container-Start auf die neueste Version aktualisieren.
# YouTube ändert laufend seine API — ein veraltetes yt-dlp führt zu Fehlern
# wie "Requested format is not available". Schlägt das Update fehl (z. B.
# offline), startet der Server trotzdem mit der eingebauten Version.
pip install --user --quiet --no-cache-dir --upgrade yt-dlp \
    || echo "WARNUNG: yt-dlp-Update fehlgeschlagen, nutze installierte Version"

exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 300 \
    --access-logfile - --error-logfile - app:app
