/**
 * API Service für Backend-Integration
 * Kommuniziert mit dem yt-dlp basierten Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Holt Video-Informationen vom Backend
 * @param {string} url - Die Video-URL (YouTube, TikTok, Reddit)
 * @returns {Promise<Object>} Video-Metadaten inkl. verfügbare Formate
 */
export async function fetchVideoInfo(url) {
  try {
    const response = await fetch(`${API_BASE_URL}/video-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Fehler beim Laden der Video-Informationen')
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
    const response = await fetch(`${API_BASE_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        format_id: formatId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Fehler beim Download')
    }

    return await response.blob()
  } catch (error) {
    console.error('Error downloading video:', error)
    throw error
  }
}

/**
 * Prüft die Verbindung zum Backend
 * @returns {Promise<boolean>} true wenn Backend erreichbar ist
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    })
    return response.ok
  } catch (error) {
    console.error('Backend health check failed:', error)
    return false
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
