import '../styles/PlaylistView.css'

const QUALITY_OPTIONS = [
  { value: 'best', label: 'Beste' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: 'audio', label: 'Nur Audio (MP3)' },
]

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function PlaylistView({
  title,
  entries,
  quality,
  onQualityChange,
  onDownloadEntry,
  onDownloadAll,
  downloadingId,
  batchProgress,
}) {
  const isBatching = batchProgress && batchProgress.done < batchProgress.total
  const anyDownloading = downloadingId !== null

  return (
    <div className="playlist-view">
      <div className="playlist-header">
        <h3>{title || 'Playlist'}</h3>
        <span className="playlist-count">{entries.length} Videos</span>
      </div>

      <div className="playlist-controls">
        <label htmlFor="playlist-quality" className="playlist-quality-label">
          Qualität:
        </label>
        <select
          id="playlist-quality"
          value={quality}
          onChange={(e) => onQualityChange(e.target.value)}
          className="playlist-quality-select"
          disabled={anyDownloading}
        >
          {QUALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          className="playlist-download-all"
          onClick={onDownloadAll}
          disabled={anyDownloading}
        >
          {isBatching
            ? `Lädt… ${batchProgress.done}/${batchProgress.total}`
            : '⬇️ Alle herunterladen'}
        </button>
      </div>

      <div className="playlist-list">
        {entries.map((entry) => {
          const duration = formatDuration(entry.duration)
          const isThis = downloadingId === entry.id
          return (
            <div key={entry.id} className="playlist-item">
              <div className="playlist-thumb-wrapper">
                {entry.thumbnail && (
                  <img
                    src={entry.thumbnail}
                    alt={entry.title}
                    className="playlist-thumbnail"
                    loading="lazy"
                  />
                )}
                {duration && <span className="playlist-duration">{duration}</span>}
              </div>
              <div className="playlist-info">
                <p className="playlist-title">{entry.title}</p>
              </div>
              <button
                className="playlist-item-download"
                onClick={() => onDownloadEntry(entry)}
                disabled={anyDownloading}
                aria-label="Herunterladen"
              >
                {isThis ? <span className="mini-spinner"></span> : '⬇️'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PlaylistView
