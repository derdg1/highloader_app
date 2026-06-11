import { useState, useEffect } from 'react'
import VideoInput from './components/VideoInput'
import VideoPreview from './components/VideoPreview'
import QualitySelector from './components/QualitySelector'
import DownloadButton from './components/DownloadButton'
import PlaylistView from './components/PlaylistView'
import DownloadHistory from './components/DownloadHistory'
import DownloadStatusBar from './components/DownloadStatusBar'
import CookieSettings from './components/CookieSettings'
import { fetchUrlInfo, triggerDownload } from './services/api'
import './styles/App.css'

function App() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [playlist, setPlaylist] = useState(null)
  const [selectedQuality, setSelectedQuality] = useState('')
  const [playlistQuality, setPlaylistQuality] = useState('best')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [batchProgress, setBatchProgress] = useState(null)
  const [downloadStatus, setDownloadStatus] = useState(null)

  useEffect(() => {
    const savedHistory = localStorage.getItem('downloadHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Hängt einen Eintrag an die Download-Historie an (max. 20, persistiert)
  const pushHistory = (item) => {
    const newHistoryItem = {
      id: Date.now() + Math.random(),
      title: item.title,
      thumbnail: item.thumbnail,
      url: item.url,
      timestamp: new Date().toISOString(),
    }
    setHistory((prev) => {
      const newHistory = [newHistoryItem, ...prev].slice(0, 20)
      localStorage.setItem('downloadHistory', JSON.stringify(newHistory))
      return newHistory
    })
  }

  // Führt einen Download aus und aktualisiert dabei die Status-/Fortschrittsleiste.
  // 'preparing' während der Server lädt/mergt, 'downloading' sobald Bytes ankommen.
  const runDownload = async (target, params, batch = null) => {
    setDownloadStatus({ phase: 'preparing', filename: target.title, received: 0, total: 0, batch })
    await triggerDownload(target.url, params, (received, total, filename) => {
      setDownloadStatus({
        phase: 'downloading',
        filename: filename || target.title,
        received,
        total,
        batch,
      })
    })
  }

  const handleUrlSubmit = async (inputUrl) => {
    setUrl(inputUrl)
    setLoading(true)
    setError(null)
    setVideoInfo(null)
    setPlaylist(null)

    try {
      const data = await fetchUrlInfo(inputUrl)

      if (data.is_playlist) {
        setPlaylist(data)
      } else {
        setVideoInfo(data)
        if (data.formats && data.formats.length > 0) {
          setSelectedQuality(data.formats[0].format_id)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!videoInfo || !selectedQuality) return
    setError(null)

    try {
      await runDownload({ title: videoInfo.title, url }, { format_id: selectedQuality })
      pushHistory({ title: videoInfo.title, thumbnail: videoInfo.thumbnail, url })
      setDownloadStatus((s) => (s ? { ...s, phase: 'done' } : s))
      setTimeout(() => setDownloadStatus(null), 1800)
    } catch (err) {
      setDownloadStatus(null)
      setError(err.message)
    }
  }

  // Lädt einen einzelnen Playlist-Eintrag in der gewählten Voreinstellung
  const handleDownloadEntry = async (entry) => {
    setDownloadingId(entry.id)
    setError(null)
    try {
      await runDownload(entry, { quality: playlistQuality })
      pushHistory(entry)
      setDownloadStatus((s) => (s ? { ...s, phase: 'done' } : s))
      setTimeout(() => setDownloadStatus(null), 1800)
    } catch (err) {
      setDownloadStatus(null)
      setError(`${entry.title}: ${err.message}`)
    } finally {
      setDownloadingId(null)
    }
  }

  // Lädt alle Einträge nacheinander; fängt Fehler pro Eintrag ab und macht bei
  // Rate-Limit (429) einen einmaligen Retry, damit der Batch nicht abbricht
  const handleDownloadAll = async () => {
    if (!playlist) return
    setError(null)
    const entries = playlist.entries
    const failed = []

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const batch = { done: i, total: entries.length }
      setBatchProgress(batch)
      setDownloadingId(entry.id)
      try {
        await runDownload(entry, { quality: playlistQuality }, batch)
        pushHistory(entry)
      } catch (err) {
        if (err.status === 429) {
          await new Promise((r) => setTimeout(r, 3000))
          try {
            await runDownload(entry, { quality: playlistQuality }, batch)
            pushHistory(entry)
          } catch (retryErr) {
            failed.push(entry.title)
          }
        } else {
          failed.push(entry.title)
        }
      }
    }

    setBatchProgress({ done: entries.length, total: entries.length })
    setDownloadingId(null)
    setDownloadStatus((s) => (s ? { ...s, phase: 'done' } : s))
    setTimeout(() => setDownloadStatus(null), 1800)
    if (failed.length > 0) {
      setError(`${failed.length} von ${entries.length} Downloads fehlgeschlagen.`)
    }
  }

  const handleClearHistory = () => {
    setHistory([])
    localStorage.removeItem('downloadHistory')
  }

  const isDownloading = downloadStatus !== null

  return (
    <div className="app">
      <header className="app-header">
        <h1>📥 Video Downloader</h1>
        <p>Videos &amp; Playlists von beliebigen Webseiten herunterladen</p>
      </header>

      <main className={`app-main ${isDownloading ? 'has-status-bar' : ''}`}>
        <CookieSettings />
        <VideoInput onSubmit={handleUrlSubmit} loading={loading} />

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Lade Informationen...</p>
          </div>
        )}

        {playlist && !loading && (
          <PlaylistView
            title={playlist.title}
            entries={playlist.entries}
            quality={playlistQuality}
            onQualityChange={setPlaylistQuality}
            onDownloadEntry={handleDownloadEntry}
            onDownloadAll={handleDownloadAll}
            downloadingId={downloadingId}
            batchProgress={batchProgress}
          />
        )}

        {videoInfo && !loading && (
          <>
            <VideoPreview videoInfo={videoInfo} />
            <QualitySelector
              formats={videoInfo.formats}
              selectedQuality={selectedQuality}
              onQualityChange={setSelectedQuality}
            />
            <DownloadButton
              onClick={handleDownload}
              disabled={!selectedQuality || isDownloading}
              downloading={isDownloading}
            />
          </>
        )}

        {history.length > 0 && (
          <DownloadHistory
            history={history}
            onClear={handleClearHistory}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>PWA Video Downloader v1.1</p>
      </footer>

      <DownloadStatusBar status={downloadStatus} />
    </div>
  )
}

export default App
