// ctrls for <video> tags

module.exports = class VideoCtrl {
  constructor(options) {
    this.video = options.video;
  }

  get volume() {
    return this.video.volume;
  }

  set volume(v) {
    this.video.volume = v;
  }

  get time() {
    return this.video.currentTime;
  }

  set time(t) {
    this.video.currentTime = t;
  }

  get duration() {
    return this.video.duration;
  }

  play() {
    this.video.play();
  }

  pause() {
    this.video.pause();
  }

  mute() {
    this.video.muted = true;
  }

  unmute() {
    this.video.muted = false;
  }

  remove() {
    // listeners removed in removeVideoListeners method in
    // `componenets/player-view.js` via `componentWillUnmount`
  }
}

