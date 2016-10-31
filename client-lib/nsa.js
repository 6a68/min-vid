const deepAssign = require('deep-assign');

const emitter = require('./emitter');
const formatTime = require('./format-time');
const sendToAddon = require('./send-to-addon');
const sendMetricsEvent = require('./send-metrics-event');

const YtCtrl = require('./ctrls/yt-ctrl');
const AudioCtrl = require('./ctrls/audio-ctrl');
const VideoCtrl = require('./ctrls/video-ctrl');

let currentStep, playerMap = {}; // eslint-disable-line no-unused-vars

function step() {
  let currentTime = 0;
  let progress = window.AppData.progress;
  let duration = 0;

  if (playerMap[window.AppData.player]) {
    currentTime = playerMap[window.AppData.player].time;
    progress = (currentTime / playerMap[window.AppData.player].duration) || window.AppData.progress;
    duration = playerMap[window.AppData.player].duration;
  }

  window.AppData = deepAssign(window.AppData, {
    currentTime: currentTime,
    time: `${formatTime(currentTime)} / ${formatTime(duration)}`,
    progress: progress,
    duration: duration
  });

  if (currentTime >= window.AppData.duration) {
    window.AppData = deepAssign(window.AppData, {
      playing: false,
      exited: currentTime ? true : false
    });

    sendMetricsEvent('player_view', 'video_ended');
  }

  if (window.AppData.playing) currentStep = requestAnimationFrame(step);
}

emitter.on('reset', () => {
  if (playerMap[window.AppData.player]) {
    currentStep = null;
    playerMap[window.AppData.player].pause();
  }

  deepAssign(window.AppData, {
    currentTime: 0,
    playing: false,
    error: false,
    exited: false,
    time: `${formatTime(0)} / ${formatTime(window.AppData.duration)}`,
    progress: 0.001
  });
})

emitter.on('init', (opts) => {
  sendMetricsEvent('player_view', 'init');

  console.log('init ', window.AppData.player, playerMap);

  if (window.AppData.player === 'audio') {
    playerMap['audio'] = new AudioCtrl(opts);
  } else if (window.AppData.player === 'youtube') {
    const PLAYING = window.YT.PlayerState.PLAYING;
    const PAUSED = window.YT.PlayerState.PAUSED;

    playerMap['youtube'] = new YtCtrl({
      id: 'video-yt',
      onReady: (ev) => {opts.onLoaded(ev.target.getDuration())},
      onStateChange: (ev) =>  {
        if (ev.data === PLAYING && !window.AppData.playing) emitter.emit('play')
        else if (ev.data === PAUSED && window.AppData.playing) emitter.emit('pause')
      },
      onError: (err) => window.AppData.error = true
    });

  } else {
    playerMap['video'] = new VideoCtrl(opts);
  }
});

emitter.on('play', (opts) => {
  sendMetricsEvent('player_view', 'play');
  // TODO(DJ): this is a special case to handle audio replays this is
  // a work around for a bug in the audiosource dependency
  if (opts && opts.replay) {
    playerMap[window.AppData.player].play(0.001);
  } else playerMap[window.AppData.player].play();

  window.AppData.playing = true;
  currentStep = requestAnimationFrame(step);
});

emitter.on('pause', (opts) => {
  sendMetricsEvent('player_view', 'pause');
  playerMap[window.AppData.player].pause();
  window.AppData.playing = false;
});

emitter.on('mute', (opts) => {
  sendMetricsEvent('player_view', 'mute');
  playerMap[window.AppData.player].mute();
  window.AppData = deepAssign(window.AppData, {muted: true});
});

emitter.on('unmute', (opts) => {
  sendMetricsEvent('player_view', 'unmute');
  playerMap[window.AppData.player].unmute();
  window.AppData = deepAssign(window.AppData, {muted: false});
});

emitter.on('replay', (opts) => {
  sendMetricsEvent('player_view', 'replay');
  emitter.emit('reset');
  emitter.emit('play', {replay: true});
});

emitter.on('load', (opts) => {
  sendMetricsEvent('player_view', 'video_loaded');

  // initial step to set times
  step();

  window.AppData = deepAssign(window.AppData, {
    loaded: true,
    duration: opts.duration
  });
});

emitter.on('set-volume', (opts) => {
  playerMap[window.AppData.player].volume = opts.value;
  window.AppData = deepAssign(window.AppData, {
    volume: opts.value
  });
});

emitter.on('set-time', (opts) => {
  playerMap[window.AppData.player].time = opts.value;

  // if we are paused force the ui to update
  if (!window.AppData.playing) {
    window.AppData = deepAssign(window.AppData, {
      time: `${formatTime(opts.value)} / ${formatTime(window.AppData.duration)}`,
      progress: opts.value / window.AppData.duration,
      currentTime: opts.value
    });
  }
});

emitter.on('update-visual', (opts) => {
  if (window.AppData.player !== 'audio') return;
  if (playerMap[window.AppData.player].fft.type === 'time') {
    playerMap[window.AppData.player].fft.type = 'frequency';
  } else playerMap[window.AppData.player].fft.type = 'time';
});

emitter.on('resize', (opts) => {
  if (window.AppData.player !== 'audio') return;
  const spacing = (opts.width < 1000) ? 1 : opts.width / 500;
  playerMap[window.AppData.player].fft.width = spacing;
  playerMap[window.AppData.player].fft.spacing = spacing;
});

emitter.on('close', () => {
  sendMetricsEvent(getView(), 'close');
  if (playerMap[window.AppData.player]) {
    playerMap[window.AppData.player].remove();
  }
  playerMap = {};
  sendToAddon({action: 'close'});
  window.AppData.error = false;
});

emitter.on('minimize', () => {
  sendMetricsEvent(getView(), 'minimize');
  sendToAddon({action: 'minimize'});
  window.AppData.minimized = true;
});

emitter.on('maximize', () => {
  sendMetricsEvent(getView(), 'maximize');
  sendToAddon({action: 'maximize'});
  window.AppData.minimized = false;
});

emitter.on('send-to-tab', () => {
  sendMetricsEvent(getView(), 'send_to_tab');
  let currentTime = 0;

  if (getView() === 'player_view') {
    currentTime = window.AppData.time;
  }

  sendToAddon({
    action: 'send-to-tab',
    id: window.AppData.id,
    domain: window.AppData.domain,
    time: currentTime,
    tabId: window.AppData.tabId,
    url: window.AppData.url
  });
  window.AppData.error = false;
});

function getView() {
  if (window.AppData.error) return 'error_view';
  return window.AppData.loaded ? 'player_view' : 'loading_view';
}
