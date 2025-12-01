import '../styles/QualitySelector.css'

function QualitySelector({ formats, selectedQuality, onQualityChange }) {
  const getQualityLabel = (format) => {
    const height = format.height || format.resolution?.split('x')[1]
    const ext = format.ext || 'mp4'
    const filesize = format.filesize ? ` (${(format.filesize / 1024 / 1024).toFixed(1)} MB)` : ''

    if (height) {
      return `${height}p - ${ext}${filesize}`
    }
    return `${format.format || format.format_note || 'Standard'} - ${ext}${filesize}`
  }

  const sortedFormats = [...formats].sort((a, b) => {
    const heightA = a.height || 0
    const heightB = b.height || 0
    return heightB - heightA
  })

  return (
    <div className="quality-selector">
      <label htmlFor="quality-select" className="quality-label">
        Qualität auswählen:
      </label>
      <select
        id="quality-select"
        value={selectedQuality}
        onChange={(e) => onQualityChange(e.target.value)}
        className="quality-select"
      >
        {sortedFormats.map((format) => (
          <option key={format.format_id} value={format.format_id}>
            {getQualityLabel(format)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default QualitySelector
