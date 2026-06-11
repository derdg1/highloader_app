import { useState, useEffect, useRef } from 'react'
import { uploadCookies, getCookieStatus, deleteCookies } from '../services/api'
import '../styles/CookieSettings.css'

function formatDate(isoString) {
  if (!isoString) return ''
  try {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return ''
  }
}

function CookieSettings() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState({ present: false, uploaded_at: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    getCookieStatus()
      .then(setStatus)
      .catch(() => {})
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const result = await uploadCookies(file)
      setStatus(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await deleteCookies()
      setStatus(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cookie-settings">
      <button
        className="cookie-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="cookie-toggle-label">
          🔐 Anmeldung / Cookies
          <span className={`cookie-badge ${status.present ? 'active' : ''}`}>
            {status.present ? 'aktiv' : 'keine'}
          </span>
        </span>
        <span className={`cookie-chevron ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="cookie-panel">
          <p className="cookie-help">
            Für private Inhalte wie deine <strong>TikTok-Sammlungen</strong> oder
            {' '}<strong>xHamster-Favoriten</strong> braucht der Server deine
            Login-Cookies. Exportiere eine <code>cookies.txt</code> (Netscape-Format)
            mit einer Browser-Erweiterung wie „Get cookies.txt LOCALLY" und lade sie
            hier hoch.
          </p>
          <p className="cookie-help">
            <strong>TikTok:</strong> Sammlung öffnen und URL kopieren:
            {' '}<code>https://www.tiktok.com/@username/collection/Name-ID</code>
            {' '}(Liked-Videos unter <code>/like</code> unterstützt yt-dlp nicht).<br />
            <strong>xHamster:</strong> Eigene Favoritenliste öffnen und URL kopieren:
            {' '}<code>https://xhamster.com/my/favorites/videos/…</code> — auch
            Länder-Domains wie <code>ge.xhamster.com</code> funktionieren.
          </p>
          <p className="cookie-privacy">
            ⚠️ Hinweis: Die Cookies sind aktive Sitzungs-Tokens und werden auf dem
            Server gespeichert. Lade sie nur hoch, wenn du dem Server vertraust.
          </p>

          {status.present ? (
            <div className="cookie-status-row">
              <span className="cookie-status-text">
                ✅ Cookies hinterlegt
                {status.uploaded_at && ` (${formatDate(status.uploaded_at)})`}
              </span>
              <button
                className="cookie-delete"
                onClick={handleDelete}
                disabled={busy}
              >
                🗑️ Löschen
              </button>
            </div>
          ) : (
            <div className="cookie-status-row">
              <span className="cookie-status-text muted">
                Keine Cookies hinterlegt
              </span>
            </div>
          )}

          <label className="cookie-upload">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFile}
              disabled={busy}
              hidden
            />
            <span className="cookie-upload-btn">
              {busy ? 'Lädt…' : status.present ? 'cookies.txt ersetzen' : 'cookies.txt hochladen'}
            </span>
          </label>

          {error && <p className="cookie-error">⚠️ {error}</p>}
        </div>
      )}
    </div>
  )
}

export default CookieSettings
