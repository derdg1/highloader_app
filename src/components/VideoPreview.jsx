import '../styles/VideoPreview.css'

function VideoPreview({ videoInfo }) {
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="video-preview">
      <div className="video-thumbnail">
        <img
          src={videoInfo.thumbnail}
          alt={videoInfo.title}
          loading="lazy"
        />
        {videoInfo.duration && (
          <span className="duration-badge">
            {formatDuration(videoInfo.duration)}
          </span>
        )}
      </div>
      <div className="video-info">
        <h2 className="video-title">{videoInfo.title}</h2>
        {videoInfo.uploader && (
          <p className="video-uploader">von {videoInfo.uploader}</p>
        )}
        {videoInfo.view_count && (
          <p className="video-views">
            {videoInfo.view_count.toLocaleString('de-DE')} Aufrufe
          </p>
        )}
      </div>
    </div>
  )
}

export default VideoPreview
