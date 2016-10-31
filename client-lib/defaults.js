module.exports = {
  id: '',
  src: '',
  url: '', // only used for <audio>, <video> tags, and soundcloud
  domain: '',
  minimized: false,
  loaded: false,
  error: false,
  muted: false,
  exited: false,
  time: '0:00 / 0:00',
  currentTime: 0,
  duration: 0,
  progress: 0.001, // force progress element to start out empty
  playing: false,
  volume: '0.5',
  strings: {},
  width: document.body.clientWidth,
  height: document.body.clientHeight,
  player: ''
};
