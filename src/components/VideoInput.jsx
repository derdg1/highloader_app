import { useState } from 'react'
import '../styles/VideoInput.css'

function VideoInput({ onSubmit, loading }) {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onSubmit(inputValue.trim())
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInputValue(text)
    } catch (err) {
      console.error('Fehler beim Einfügen:', err)
    }
  }

  return (
    <div className="video-input">
      <form onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Video- oder Playlist-URL einfügen..."
            className="url-input"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handlePaste}
            className="paste-button"
            disabled={loading}
            aria-label="Einfügen"
          >
            📋
          </button>
        </div>
        <button
          type="submit"
          className="submit-button"
          disabled={loading || !inputValue.trim()}
        >
          {loading ? 'Laden...' : 'Video laden'}
        </button>
      </form>
    </div>
  )
}

export default VideoInput
