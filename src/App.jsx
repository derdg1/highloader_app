import { useState, useEffect } from 'react'
import VideoInput from './components/VideoInput'
import VideoPreview from './components/VideoPreview'
import QualitySelector from './components/QualitySelector'
import DownloadButton from './components/DownloadButton'
import DownloadHistory from './components/DownloadHistory'
import './styles/App.css'

function App() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [selectedQuality, setSelectedQuality] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const savedHistory = localStorage.getItem('downloadHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  const handleUrlSubmit = async (inputUrl) => {
    setUrl(inputUrl)
    setLoading(true)
    setError(null)
    setVideoInfo(null)

    try {
      const response = await fetch('/api/video-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl }),
      })

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Video-Informationen')
      }

      const data = await response.json()
      setVideoInfo(data)

      if (data.formats && data.formats.length > 0) {
        setSelectedQuality(data.formats[0].format_id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!videoInfo || !selectedQuality) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          format_id: selectedQuality,
        }),
      })

      if (!response.ok) {
        throw new Error('Fehler beim Download')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${videoInfo.title}.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      const newHistoryItem = {
        id: Date.now(),
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        url: url,
        timestamp: new Date().toISOString(),
      }

      const newHistory = [newHistoryItem, ...history].slice(0, 20)
      setHistory(newHistory)
      localStorage.setItem('downloadHistory', JSON.stringify(newHistory))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = () => {
    setHistory([])
    localStorage.removeItem('downloadHistory')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📥 Video Downloader</h1>
        <p>YouTube • TikTok • Reddit</p>
      </header>

      <main className="app-main">
        <VideoInput onSubmit={handleUrlSubmit} loading={loading} />

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Lade Video-Informationen...</p>
          </div>
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
              disabled={!selectedQuality || loading}
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
        <p>PWA Video Downloader v1.0</p>
      </footer>
    </div>
  )
}

export default App
