/**
 * API Service für Backend-Integration
 * Kommuniziert mit dem yt-dlp basierten Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Timeout für Requests (5 Minuten für Downloads)
const DEFAULT_TIMEOUT = 300000 // 5 Minuten

/**
 * Fetch mit Timeout
 * @param {string} url - Die URL
 * @param {Object} options - Fetch Optionen
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request Timeout: Der Server antwortet nicht. Bitte versuche es später erneut.')
    }
    throw error
  }
}

/**
 * Holt Informationen zu einer URL vom Backend. Das Backend erkennt automatisch,
 * ob es sich um ein Einzelvideo oder eine Playlist/einen Kanal handelt.
 * @param {string} url - Die Video- oder Playlist-URL
 * @returns {Promise<Object>} Bei Einzelvideo: { is_playlist:false, title, thumbnail, formats, ... }
 *                            Bei Playlist:    { is_playlist:true, title, entry_count, entries: [...] }
 */
export async function fetchUrlInfo(url) {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/video-info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      },
      60000 // 1 Minute Timeout für Info-Abruf
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || 'Unbekannter Fehler')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching url info:', error)
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Keine Verbindung zum Server. Bitte überprüfe deine Internetverbindung.')
    }
    throw error
  }
}

/**
 * Liest den Dateinamen aus einem Content-Disposition-Header.
 * Unterstützt sowohl filename="..." als auch filename*=UTF-8''...
 * @param {string|null} header
 * @returns {string|null}
 */
function parseContentDisposition(header) {
  if (!header) return null
  // RFC 5987: filename*=UTF-8''<percent-encoded>
  const extended = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // fällt unten auf den einfachen Header zurück
    }
  }
  const simple = header.match(/filename="?([^";]+)"?/i)
  return simple ? simple[1].trim() : null
}

/**
 * Lädt ein Video/Audio herunter und speichert es im Browser. Der Dateiname wird
 * aus dem Content-Disposition-Header des Servers übernommen (korrekte Endung
 * auch bei Audio/MP3).
 * @param {string} url - Die Video-URL
 * @param {Object} params - { format_id } oder { quality: 'best'|'1080'|'720'|'audio' }
 * @returns {Promise<string|null>} Der verwendete Dateiname
 */
export async function triggerDownload(url, params) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/download`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...params }),
    },
    300000 // 5 Minuten Timeout für Download
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.error || errorData.message || 'Download fehlgeschlagen')
    error.status = response.status
    throw error
  }

  const filename = parseContentDisposition(response.headers.get('Content-Disposition'))
  const blob = await response.blob()

  if (blob.size === 0) {
    throw new Error('Download fehlgeschlagen: Datei ist leer')
  }

  const objectUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  if (filename) a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(objectUrl)
  document.body.removeChild(a)

  return filename
}

/**
 * Prüft die Verbindung zum Backend
 * @returns {Promise<Object>} { healthy: boolean, message: string }
 */
export async function checkBackendHealth() {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/health`,
      {
        method: 'GET',
      },
      10000 // 10 Sekunden Timeout für Health Check
    )

    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      return {
        healthy: true,
        message: 'Backend ist erreichbar',
        data,
      }
    }

    return {
      healthy: false,
      message: `Backend antwortet mit Status ${response.status}`,
    }
  } catch (error) {
    console.error('Backend health check failed:', error)
    return {
      healthy: false,
      message: error.message || 'Backend nicht erreichbar',
    }
  }
}

/**
 * Grobe Vorab-Prüfung im Browser, ob die Eingabe eine http(s)-URL ist.
 * Die eigentliche Validierung (inkl. SSRF-Schutz) erfolgt serverseitig, da
 * yt-dlp Hunderte Seiten unterstützt und keine Host-Allowlist mehr gilt.
 * @param {string} url - Die zu prüfende URL
 * @returns {boolean} true wenn die Eingabe wie eine http(s)-URL aussieht
 */
export function validateVideoUrl(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}
