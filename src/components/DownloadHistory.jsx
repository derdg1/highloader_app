import '../styles/DownloadHistory.css'

function DownloadHistory({ history, onClear }) {
  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="download-history">
      <div className="history-header">
        <h3>Download-Historie</h3>
        <button onClick={onClear} className="clear-button">
          🗑️ Löschen
        </button>
      </div>
      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <img
              src={item.thumbnail}
              alt={item.title}
              className="history-thumbnail"
              loading="lazy"
            />
            <div className="history-info">
              <p className="history-title">{item.title}</p>
              <p className="history-date">{formatDate(item.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DownloadHistory
