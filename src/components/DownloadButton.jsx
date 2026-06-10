import '../styles/DownloadButton.css'

function DownloadButton({ onClick, disabled, downloading }) {
  return (
    <button
      className="download-button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="download-icon">{downloading ? '⏳' : '⬇️'}</span>
      <span className="download-text">
        {downloading ? 'Lädt herunter…' : 'Video herunterladen'}
      </span>
    </button>
  )
}

export default DownloadButton
