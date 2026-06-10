import '../styles/DownloadStatusBar.css'

function formatBytes(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

function DownloadStatusBar({ status }) {
  if (!status) return null

  const { phase, filename, received, total, batch } = status
  const hasTotal = total > 0
  const percent = hasTotal ? Math.min(100, Math.round((received / total) * 100)) : 0
  const indeterminate = phase === 'preparing' || (phase === 'downloading' && !hasTotal)

  let statusText
  if (phase === 'preparing') {
    statusText = 'Wird vorbereitet…'
  } else if (phase === 'done') {
    statusText = 'Fertig ✓'
  } else if (hasTotal) {
    statusText = `${formatBytes(received)} / ${formatBytes(total)}`
  } else {
    statusText = `${formatBytes(received)} geladen`
  }

  return (
    <div className="download-status-bar" role="status" aria-live="polite">
      <div className="dsb-content">
        <div className="dsb-row">
          <span className="dsb-icon">{phase === 'done' ? '✅' : '⬇️'}</span>
          <span className="dsb-filename" title={filename}>
            {filename || 'Download'}
          </span>
          {batch && (
            <span className="dsb-batch">
              {Math.min(batch.done + 1, batch.total)}/{batch.total}
            </span>
          )}
          {!indeterminate && phase === 'downloading' && (
            <span className="dsb-percent">{percent}%</span>
          )}
        </div>

        <div className={`dsb-track ${indeterminate ? 'indeterminate' : ''}`}>
          <div
            className="dsb-fill"
            style={indeterminate ? undefined : { width: `${phase === 'done' ? 100 : percent}%` }}
          />
        </div>

        <div className="dsb-meta">{statusText}</div>
      </div>
    </div>
  )
}

export default DownloadStatusBar
