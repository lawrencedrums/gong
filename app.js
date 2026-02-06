// Meditation Timer App

// =============================================================================
// State
// =============================================================================
const state = {
  totalTime: 600,           // 10 min default (seconds)
  preCountdown: 5,          // 5 sec default
  preCountdownEnabled: true,
  startSound: 'bell',
  endSound: 'tibetan-bowl',
  repeatEndSound: false,
  isRunning: false,
  isPaused: false,
  currentPhase: 'idle',     // 'idle' | 'pre' | 'main'
  remainingTime: 600,
  intervalId: null
};

// =============================================================================
// DOM Elements
// =============================================================================
const elements = {
  menuBtn: document.getElementById('menuBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  settingsOverlay: document.getElementById('settingsOverlay'),
  timerDisplay: document.getElementById('timerDisplay'),
  phaseIndicator: document.getElementById('phaseIndicator'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  preCountdownToggle: document.getElementById('preCountdownToggle'),
  preCountdownOptions: document.querySelector('.pre-countdown-options'),
  customMinutes: document.getElementById('customMinutes'),
  startSound: document.getElementById('startSound'),
  endSound: document.getElementById('endSound'),
  repeatEndSoundToggle: document.getElementById('repeatEndSoundToggle'),
  testSoundBtn: document.getElementById('testSoundBtn'),
  presetBtns: document.querySelectorAll('.preset-btn[data-minutes]'),
  preBtns: document.querySelectorAll('.preset-btn[data-seconds]')
};

// =============================================================================
// Audio System
// =============================================================================
let audioContext = null;
const audioBuffers = {};

async function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Preload all sounds
    const sounds = ['bell', 'tibetan-bowl', 'gong'];
    await Promise.all(sounds.map(loadSound));
  } catch (err) {
    console.warn('Audio initialization failed:', err);
  }
}

// Map sound names to actual filenames
const soundFiles = {
  'bell': 'bell.mp3',
  'tibetan-bowl': 'e-flat-tibetan-singing-bowl-struck-38746.mp3',
  'gong': 'gong.mp3'
};

async function loadSound(name) {
  try {
    const filename = soundFiles[name] || `${name}.mp3`;
    const response = await fetch(`sounds/${filename}`);
    if (!response.ok) {
      // Generate a simple tone as fallback
      audioBuffers[name] = createFallbackTone(name);
      return;
    }
    const arrayBuffer = await response.arrayBuffer();
    audioBuffers[name] = await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.warn(`Failed to load ${name}, using fallback tone`);
    audioBuffers[name] = createFallbackTone(name);
  }
}

function createFallbackTone(name) {
  // Create different tones for different sounds
  const frequencies = {
    'bell': 880,
    'tibetan-bowl': 528,
    'gong': 196
  };

  const sampleRate = audioContext.sampleRate;
  const duration = 2;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const freq = frequencies[name] || 440;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Simple decaying sine wave
    const envelope = Math.exp(-t * 2);
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
  }

  return buffer;
}

function playSound(soundName) {
  if (!audioContext || soundName === 'none') return;

  // Resume audio context if suspended (required for autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const buffer = audioBuffers[soundName];
  if (!buffer) return;

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.7;

  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start(0);
}

// =============================================================================
// Timer Functions
// =============================================================================
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateDisplay() {
  elements.timerDisplay.textContent = formatTime(state.remainingTime);

  // Update phase indicator and styling
  if (state.currentPhase === 'pre') {
    elements.phaseIndicator.textContent = 'Get Ready';
    elements.timerDisplay.classList.add('pre-countdown');
  } else if (state.currentPhase === 'main') {
    elements.phaseIndicator.textContent = 'Breathe';
    elements.timerDisplay.classList.remove('pre-countdown');
  } else {
    elements.phaseIndicator.textContent = '';
    elements.timerDisplay.classList.remove('pre-countdown');
  }
}

function startTimer() {
  if (state.isRunning && !state.isPaused) {
    // Pause the timer
    state.isPaused = true;
    clearInterval(state.intervalId);
    elements.startBtn.textContent = 'RESUME';
    return;
  }

  if (state.isPaused) {
    // Resume from pause
    state.isPaused = false;
    elements.startBtn.textContent = 'PAUSE';
    elements.startBtn.classList.add('running');
    runTimer();
    return;
  }

  // Fresh start
  state.isRunning = true;
  state.isPaused = false;
  elements.startBtn.textContent = 'PAUSE';
  elements.startBtn.classList.add('running');
  elements.resetBtn.style.display = 'block';

  // Unlock audio on user interaction
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  if (state.preCountdownEnabled && state.preCountdown > 0) {
    // Start with pre-countdown
    state.currentPhase = 'pre';
    state.remainingTime = state.preCountdown;
    updateDisplay();
    runTimer();
  } else {
    // Skip to main timer
    state.currentPhase = 'main';
    state.remainingTime = state.totalTime;
    playSound(state.startSound);
    updateDisplay();
    runTimer();
  }
}

function runTimer() {
  state.intervalId = setInterval(() => {
    state.remainingTime--;

    if (state.remainingTime <= 0) {
      clearInterval(state.intervalId);

      if (state.currentPhase === 'pre') {
        // Pre-countdown finished, start main timer
        state.currentPhase = 'main';
        state.remainingTime = state.totalTime;
        playSound(state.startSound);
        updateDisplay();
        runTimer();
      } else {
        // Main timer finished
        playSound(state.endSound);
        if (state.repeatEndSound) {
          setTimeout(() => playSound(state.endSound), 2000);
          setTimeout(() => playSound(state.endSound), 4000);
        }
        timerComplete();
      }
    } else {
      updateDisplay();
    }
  }, 1000);
}

function timerComplete() {
  state.isRunning = false;
  state.isPaused = false;
  state.currentPhase = 'idle';
  state.remainingTime = state.totalTime;

  elements.startBtn.textContent = 'START';
  elements.startBtn.classList.remove('running');
  elements.resetBtn.style.display = 'none';
  elements.phaseIndicator.textContent = 'Complete';

  // Clear "Complete" after 3 seconds
  setTimeout(() => {
    if (state.currentPhase === 'idle') {
      elements.phaseIndicator.textContent = '';
    }
  }, 3000);

  updateDisplay();
}

function resetTimer() {
  clearInterval(state.intervalId);
  state.isRunning = false;
  state.isPaused = false;
  state.currentPhase = 'idle';
  state.remainingTime = state.totalTime;

  elements.startBtn.textContent = 'START';
  elements.startBtn.classList.remove('running');
  elements.resetBtn.style.display = 'none';
  elements.phaseIndicator.textContent = '';

  updateDisplay();
}

// =============================================================================
// Settings Functions
// =============================================================================
function openSettings() {
  elements.settingsPanel.classList.add('active');
  elements.settingsOverlay.classList.add('active');
  elements.menuBtn.classList.add('active');
}

function closeSettings() {
  elements.settingsPanel.classList.remove('active');
  elements.settingsOverlay.classList.remove('active');
  elements.menuBtn.classList.remove('active');
}

function setDuration(minutes) {
  state.totalTime = minutes * 60;
  if (!state.isRunning) {
    state.remainingTime = state.totalTime;
    updateDisplay();
  }

  // Update UI
  elements.presetBtns.forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
  });
  elements.customMinutes.value = '';

  saveSettings();
}

function setPreCountdown(seconds) {
  state.preCountdown = seconds;

  // Update UI
  elements.preBtns.forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.seconds) === seconds);
  });

  saveSettings();
}

function togglePreCountdown(enabled) {
  state.preCountdownEnabled = enabled;
  elements.preCountdownOptions.classList.toggle('disabled', !enabled);
  saveSettings();
}

function saveSettings() {
  const settings = {
    totalTime: state.totalTime,
    preCountdown: state.preCountdown,
    preCountdownEnabled: state.preCountdownEnabled,
    startSound: state.startSound,
    endSound: state.endSound,
    repeatEndSound: state.repeatEndSound
  };
  localStorage.setItem('meditationSettings', JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem('meditationSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);

      state.totalTime = settings.totalTime || 600;
      state.preCountdown = settings.preCountdown || 5;
      state.preCountdownEnabled = settings.preCountdownEnabled !== false;
      state.startSound = settings.startSound || 'bell';
      state.endSound = settings.endSound || 'tibetan-bowl';
      state.repeatEndSound = settings.repeatEndSound || false;
      state.remainingTime = state.totalTime;

      // Update UI to reflect loaded settings
      const minutes = state.totalTime / 60;
      elements.presetBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
      });

      elements.preBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.seconds) === state.preCountdown);
      });

      elements.preCountdownToggle.checked = state.preCountdownEnabled;
      elements.preCountdownOptions.classList.toggle('disabled', !state.preCountdownEnabled);

      elements.startSound.value = state.startSound;
      elements.endSound.value = state.endSound;
      elements.repeatEndSoundToggle.checked = state.repeatEndSound;

    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }

  updateDisplay();
}

// =============================================================================
// Event Listeners
// =============================================================================
function initEventListeners() {
  // Menu toggle
  elements.menuBtn.addEventListener('click', () => {
    if (elements.settingsPanel.classList.contains('active')) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  // Close settings when clicking overlay
  elements.settingsOverlay.addEventListener('click', closeSettings);

  // Timer controls
  elements.startBtn.addEventListener('click', startTimer);
  elements.resetBtn.addEventListener('click', resetTimer);

  // Duration presets
  elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setDuration(parseInt(btn.dataset.minutes));
    });
  });

  // Custom duration
  elements.customMinutes.addEventListener('change', (e) => {
    const minutes = parseInt(e.target.value);
    if (minutes > 0 && minutes <= 120) {
      setDuration(minutes);
      // Remove active from presets
      elements.presetBtns.forEach(btn => btn.classList.remove('active'));
    }
  });

  // Pre-countdown toggle
  elements.preCountdownToggle.addEventListener('change', (e) => {
    togglePreCountdown(e.target.checked);
  });

  // Pre-countdown duration
  elements.preBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setPreCountdown(parseInt(btn.dataset.seconds));
    });
  });

  // Sound selections
  elements.startSound.addEventListener('change', (e) => {
    state.startSound = e.target.value;
    saveSettings();
  });

  elements.endSound.addEventListener('change', (e) => {
    state.endSound = e.target.value;
    saveSettings();
  });

  elements.repeatEndSoundToggle.addEventListener('change', (e) => {
    state.repeatEndSound = e.target.checked;
    saveSettings();
  });

  // Test sound button
  elements.testSoundBtn.addEventListener('click', () => {
    playSound(state.endSound);
  });

  // Prevent screen from sleeping during meditation (if supported)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isRunning && !state.isPaused) {
      // Keep timer running in background
      // Note: setInterval continues in background on most browsers
    }
  });
}

// =============================================================================
// Service Worker Registration
// =============================================================================
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker registered:', registration.scope);

      // Check for updates immediately on page load
      registration.update();

      // If a new SW is already waiting, it will activate via skipWaiting
      // and trigger controllerchange below
      if (registration.waiting) {
        console.log('New Service Worker waiting, will activate shortly');
      }

      // Listen for new service workers installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('New Service Worker activated');
          }
        });
      });
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }

    // Reload the page when a new service worker takes control
    // This fires after skipWaiting + clients.claim in the new SW
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

// =============================================================================
// Initialize App
// =============================================================================
async function init() {
  loadSettings();
  initEventListeners();
  await initAudio();
  await registerServiceWorker();

  // Set default active states if none saved
  if (!localStorage.getItem('meditationSettings')) {
    elements.presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.minutes === '10');
    });
    elements.preBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.seconds === '5');
    });
  }
}

// Start the app
init();
