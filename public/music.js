(() => {
  const { musicSource } = document.querySelector('[data-music-source]').dataset;
  const toggle = document.querySelector('[data-music-toggle]');
  const playIcon = document.querySelector('[data-music-play]');
  const pauseIcon = document.querySelector('[data-music-pause]');
  const volume = document.querySelector('[data-music-volume]');
  const status = document.querySelector('[data-music-status]');
  let audio;
  let masterVolume;
  let song;
  let songLoad;
  let nextStart;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function updateButton() {
    const playing = Boolean(song && audio.state === 'running');
    playIcon.hidden = playing;
    pauseIcon.hidden = !playing;
    toggle.setAttribute('aria-label', playing ? 'Pausar música' : 'Reproducir música');
  }

  function scheduleTrack() {
    const overlap = Math.min(1.8, song.duration / 4);
    const start = Math.max(nextStart, audio.currentTime);
    const end = start + song.duration;
    const track = audio.createBufferSource();
    const fade = audio.createGain();
    track.buffer = song;
    track.connect(fade);
    fade.connect(masterVolume);
    fade.gain.setValueAtTime(0, start);
    fade.gain.linearRampToValueAtTime(1, start + overlap);
    fade.gain.setValueAtTime(1, end - overlap);
    fade.gain.linearRampToValueAtTime(0, end);
    track.start(start);
    nextStart = end - overlap;

    track.addEventListener('ended', () => {
      track.disconnect();
      fade.disconnect();
      scheduleTrack();
    }, { once: true });
  }

  async function loadSong() {
    showStatus('Cargando canción…');
    try {
      const response = await fetch(musicSource);
      if (!response.ok) throw new Error('Audio: ' + response.status);
      song = await audio.decodeAudioData(await response.arrayBuffer());
      // Agenda el siguiente inicio antes de que termine la primera reproducción.
      nextStart = audio.currentTime + .03;
      scheduleTrack();
      scheduleTrack();
      updateButton();
    } finally {
      showStatus('');
    }
  }

  async function play() {
    if (!audio) {
      audio = new AudioContext();
      masterVolume = audio.createGain();
      masterVolume.gain.value = Number(volume.value) / 100;
      masterVolume.connect(audio.destination);
      audio.addEventListener('statechange', updateButton);
    }

    await audio.resume();
    if (song) return;
    songLoad ??= loadSong().finally(() => { songLoad = null; });
    await songLoad;
  }

  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try {
      if (song && audio.state === 'running') {
        await audio.suspend();
      } else {
        await play();
      }
      showStatus('');
    } catch {
      showStatus('No se pudo reproducir la canción.');
    } finally {
      updateButton();
      toggle.disabled = false;
    }
  });

  volume.addEventListener('input', () => {
    volume.style.setProperty('--volume-level', volume.value + '%');
    masterVolume?.gain.setTargetAtTime(Number(volume.value) / 100, audio.currentTime, .03);
  });

  async function checkAudio() {
    if (!window.AudioContext) return;
    const response = await fetch(musicSource, { method: 'HEAD' }).catch(() => null);
    if (!response?.ok || response.headers.get('content-type')?.startsWith('text/html')) return;
    toggle.disabled = false;
    volume.disabled = false;
    // Si el navegador exige un gesto, el botón sigue disponible para iniciar el audio.
    play().catch(() => {});
  }

  checkAudio();
})();
