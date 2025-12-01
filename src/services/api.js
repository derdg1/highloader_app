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
 * Holt Video-Informationen vom Backend
 * @param {string} url - Die Video-URL (YouTube, TikTok, Reddit)
 * @returns {Promise<Object>} Video-Metadaten inkl. verfügbare Formate
 */
export async function fetchVideoInfo(url) {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/video-info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      },
      60000 // 1 Minute Timeout für Video-Info
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.message || 'Unbekannter Fehler'

      if (response.status === 400) {
        throw new Error(`Ungültige Video-URL oder Video nicht verfügbar: ${errorMessage}`)
      } else if (response.status === 500) {
        throw new Error(`Server-Fehler: ${errorMessage}`)
      } else if (response.status === 404) {
        throw new Error('Backend-Server nicht erreichbar. Bitte prüfe die Verbindung.')
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()

    return {
      title: data.title,
      thumbnail: data.thumbnail,
      duration: data.duration,
      uploader: data.uploader,
      view_count: data.view_count,
      formats: data.formats || [],
    }
  } catch (error) {
    console.error('Error fetching video info:', error)

    // Verbessere Fehlermeldungen für häufige Probleme
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Keine Verbindung zum Server. Bitte überprüfe deine Internetverbindung.')
    }

    throw error
  }
}

/**
 * Lädt ein Video vom Backend herunter
 * @param {string} url - Die Video-URL
 * @param {string} formatId - Die gewählte Format-ID
 * @returns {Promise<Blob>} Video-Datei als Blob
 */
export async function downloadVideo(url, formatId) {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/download`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          format_id: formatId,
        }),
      },
      300000 // 5 Minuten Timeout für Download
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.message || 'Unbekannter Fehler'

      if (response.status === 400) {
        throw new Error(`Download fehlgeschlagen: ${errorMessage}`)
      } else if (response.status === 500) {
        throw new Error(`Server-Fehler beim Download: ${errorMessage}`)
      } else if (response.status === 404) {
        throw new Error('Download-Service nicht verfügbar. Bitte versuche es später erneut.')
      }

      throw new Error(errorMessage)
    }

    const blob = await response.blob()

    // Prüfe ob wir wirklich einen Video-Blob erhalten haben
    if (blob.size === 0) {
      throw new Error('Download fehlgeschlagen: Datei ist leer')
    }

    return blob
  } catch (error) {
    console.error('Error downloading video:', error)

    // Verbessere Fehlermeldungen
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Download fehlgeschlagen: Keine Verbindung zum Server')
    }

    throw error
  }
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
 * Validiert eine Video-URL
 * @param {string} url - Die zu prüfende URL
 * @returns {boolean} true wenn URL valide ist
 */
export function validateVideoUrl(url) {
  try {
    const urlObj = new URL(url)
    const validDomains = [
      'youtube.com',
      'youtu.be',
      'tiktok.com',
      'reddit.com',
      'redd.it',
      'vm.tiktok.com',
    ]

    return validDomains.some(domain => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}
