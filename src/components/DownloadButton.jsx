import '../styles/DownloadButton.css'

function DownloadButton({ onClick, disabled }) {
  return (
    <button
      className="download-button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="download-icon">⬇️</span>
      <span className="download-text">Video herunterladen</span>
    </button>
  )
}

export default DownloadButton
