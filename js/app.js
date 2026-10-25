// DOM References
const albumTitleEl = document.getElementById('album-title');
const albumYearEl = document.getElementById('album-year');
const tracklistEl = document.getElementById('tracklist');
const audioL = document.getElementById('audio');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const mainPlayBtn = document.getElementById('main-play-btn');
const mainPlayIcon = document.getElementById('main-play-icon');

let currentActiveRow = null;
let currentTrackIndex = null;

// Utility: Format seconds into m:ss or -m:ss
function formatTime(seconds, isNegative = false) {
  if (isNaN(seconds) || seconds < 0) return isNegative ? "-0:00" : "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const formattedSecs = secs < 10 ? `0${secs}` : secs;
  return `${isNegative ? '-' : ''}${mins}:${formattedSecs}`;
}

// Utility: Force file download using Blob fetch
function forceDownload(url, filename) {
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(err => {
      console.error('Download failed:', err);
    });
}

// Dynamic Tracklist Renderer
function renderAlbum(albumData) {
  albumTitleEl.textContent = albumData.name;
  
  // Render year and album ZIP download link
  const zipFilename = `${albumData.name}.zip`;
  const zipPath = `assets/${zipFilename}`;
  albumYearEl.innerHTML = `${albumData.year} &bull; <a href="#" class="album-download-link">Download</a>`;

  const albumDownloadLink = albumYearEl.querySelector('.album-download-link');
  albumDownloadLink.addEventListener('click', (e) => {
    e.preventDefault();
    forceDownload(zipPath, zipFilename);
  });

  tracklistEl.innerHTML = '';

  albumData.tracklist.forEach((track, index) => {
    const li = document.createElement('li');
    li.className = 'track-row';
    li.dataset.index = index;

    li.innerHTML = `
      <div class="track-main">
        <button class="play-btn" aria-label="Play ${track.name}">
          <span class="play-icon">&#9654;</span>
        </button>
        <div class="track-info">
          <span class="track-title-num">${index + 1}. ${track.name}</span>
          <span class="track-length">${track.length}</span>
          <a class="download-link" title="Download track"> Download</a>
        </div>
      </div>
      <div class="progress-wrapper">
        <div class="progress-container">
          <div class="progress-bar"></div>
        </div>
        <div class="time-display">
          <span class="time-current">0:00</span>
          <span class="time-remaining">-${track.length}</span>
        </div>
      </div>
    `;

    // Event Listener: Play/Pause Button
    const playBtn = li.querySelector('.play-btn');
    playBtn.addEventListener('click', () => togglePlayTrack(track, index, li));

    // Event Listener: Download Link
    const downloadLink = li.querySelector('.download-link');
    downloadLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const safeName = `${track.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
      forceDownload(track.src, safeName);
    });

    // Event Listener: Clickable Progress Bar for Seeking
    const progressContainer = li.querySelector('.progress-container');
    progressContainer.addEventListener('click', (e) => {
      if (currentTrackIndex === index && audioL.duration) {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        audioL.currentTime = percentage * audioL.duration;
      }
    });

    tracklistEl.appendChild(li);
  });
}

// Configure Media Session API for OS media players (e.g., iPhone Home/Lock screen)
function updateMediaSession(track, albumData) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: "Blake Cooper",
      album: albumData.name,
      artwork: [
        { src: document.getElementById('album-cover').src, sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => { audioL.play(); });
    navigator.mediaSession.setActionHandler('pause', () => { audioL.pause(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { prevBtn.click(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { nextBtn.click(); });
  }
}

// Playback State Toggle
function togglePlayTrack(track, index, rowEl) {
  if (currentTrackIndex === index) {
    if (audioL.paused) {
      audioL.play();
      updatePlayStateUI(rowEl, true);
    } else {
      audioL.pause();
      updatePlayStateUI(rowEl, false);
    }
    return;
  }

  // Deactivate previous row if active
  if (currentActiveRow) {
    currentActiveRow.classList.remove('active');
    updatePlayStateUI(currentActiveRow, false);
    resetRowProgress(currentActiveRow);
  }

  // Activate new track
  currentTrackIndex = index;
  currentActiveRow = rowEl;
  rowEl.classList.add('active');

  // Auto-scroll track list to show currently playing track
  rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  audioL.src = track.src;
  audioL.play();
  updatePlayStateUI(rowEl, true);

  if (typeof music !== 'undefined' && music.length > 0) {
    updateMediaSession(track, music[0]);
  }
}

// Update Play/Pause UI across track row and main control bar
function updatePlayStateUI(rowEl, isPlaying) {
  const icon = rowEl.querySelector('.play-icon');
  if (isPlaying) {
    icon.innerHTML = '&#10074;&#10074;';
    mainPlayIcon.innerHTML = '&#10074;&#10074;';
  } else {
    icon.innerHTML = '&#9654;';
    mainPlayIcon.innerHTML = '&#9654;';
  }
}

// Reset Progress UI
function resetRowProgress(rowEl) {
  const progressBar = rowEl.querySelector('.progress-bar');
  const timeCurrent = rowEl.querySelector('.time-current');
  const timeRemaining = rowEl.querySelector('.time-remaining');
  progressBar.style.width = '0%';
  timeCurrent.textContent = '0:00';
  timeRemaining.textContent = '-0:00';
}

// Global Audio Progress Event Listeners
audioL.addEventListener('timeupdate', () => {
  if (!currentActiveRow || isNaN(audioL.duration)) return;

  const current = audioL.currentTime;
  const total = audioL.duration;
  const remaining = total - current;
  const percentage = (current / total) * 100;

  const progressBar = currentActiveRow.querySelector('.progress-bar');
  const timeCurrent = currentActiveRow.querySelector('.time-current');
  const timeRemaining = currentActiveRow.querySelector('.time-remaining');

  progressBar.style.width = `${percentage}%`;
  timeCurrent.textContent = formatTime(current);
  timeRemaining.textContent = formatTime(remaining, true);
});

// Automatic progression on track end (stops at the end of the album)
audioL.addEventListener('ended', () => {
  if (currentTrackIndex !== null && typeof music !== 'undefined') {
    const nextIndex = currentTrackIndex + 1;
    const trackList = music[0].tracklist;
    
    if (nextIndex < trackList.length) {
      const nextRow = tracklistEl.children[nextIndex];
      togglePlayTrack(trackList[nextIndex], nextIndex, nextRow);
    } else {
      // Reached the end of the album: stop playback and reset
      if (currentActiveRow) {
        updatePlayStateUI(currentActiveRow, false);
        resetRowProgress(currentActiveRow);
      }
      currentTrackIndex = null;
      currentActiveRow = null;
      mainPlayIcon.innerHTML = '&#9654;';
    }
  }
});

// Main Play/Pause Button Controls
mainPlayBtn.addEventListener('click', () => {
  if (typeof music === 'undefined' || music.length === 0) return;

  const trackList = music[0].tracklist;
  if (currentTrackIndex === null) {
    togglePlayTrack(trackList[0], 0, tracklistEl.children[0]);
  } else {
    if (audioL.paused) {
      audioL.play();
      updatePlayStateUI(currentActiveRow, true);
    } else {
      audioL.pause();
      updatePlayStateUI(currentActiveRow, false);
    }
  }
});

// Previous Track Button Control
prevBtn.addEventListener('click', () => {
  if (typeof music === 'undefined' || music.length === 0) return;
  const trackList = music[0].tracklist;
  
  let targetIndex = currentTrackIndex !== null ? currentTrackIndex - 1 : 0;
  if (targetIndex < 0) targetIndex = trackList.length - 1;

  const targetRow = tracklistEl.children[targetIndex];
  togglePlayTrack(trackList[targetIndex], targetIndex, targetRow);
});

// Next Track Button Control (stops working / halts playback on the last song)
nextBtn.addEventListener('click', () => {
  if (typeof music === 'undefined' || music.length === 0) return;
  const trackList = music[0].tracklist;
  if (currentTrackIndex === null) return;
  
  const targetIndex = currentTrackIndex + 1;
  if (targetIndex >= trackList.length) {
    audioL.pause();
    audioL.currentTime = 0;
    if (currentActiveRow) {
      updatePlayStateUI(currentActiveRow, false);
      resetRowProgress(currentActiveRow);
    }
    currentTrackIndex = null;
    currentActiveRow = null;
    mainPlayIcon.innerHTML = '&#9654;';
    return;
  }

  const targetRow = tracklistEl.children[targetIndex];
  togglePlayTrack(trackList[targetIndex], targetIndex, targetRow);
});

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  if (typeof music !== 'undefined' && music.length > 0) {
    renderAlbum(music[0]);
  }
});