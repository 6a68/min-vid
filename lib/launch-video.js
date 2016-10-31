const getVideoId = require('get-video-id');
const getPlayer = require('./get-player');
const getLocaleStrings = require('./get-locale-strings');
const windowUtils = require('./window-utils');

module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts) {
  // UpdateWindow might create a new panel, so do the remaining launch work
  // asynchronously.
  windowUtils.updateWindow();
  windowUtils.whenReady(() => {
    // opts {url: url,
    //       getUrlFn: getYouTubeUrl,
    //       domain: 'youtube.com',
    //       time: 16 // integer seconds OPTIONAL
    //       src: streamURL or ''}
    const id = getVideoId(opts.url);
    const player = getPlayer(opts);
    console.log('player in launch-video ', player, ' opts ', opts);
    const isAudio = (!!~opts.domain.indexOf('soundcloud') || player === 'audio');

    windowUtils.show();
    windowUtils.send('set-video', {
      domain: opts.domain,
      id: id || '',
      src: opts.src || '',
      volume: opts.volume || 0.5,
      muted: opts.muted || false,
      strings: getLocaleStrings(opts.domain, isAudio),
      tabId: require('sdk/tabs').activeTab.id,
      url: id ? '' : opts.url, // only send url down if not vimeo or YouTube
      player: player
    });
    if (!opts.src) {
      opts.getUrlFn(id ? id : opts.url, function(err, streamUrl) {
        if (err) console.error('LaunchVideo failed to get the streamUrl: ', err); // eslint-disable-line no-console
        console.log('getUrlFn set-video', player, ' streamUrl ', streamUrl);
        windowUtils.send('set-video', {
          src: streamUrl,
          error: Boolean(err),
          strings: getLocaleStrings(opts.domain, isAudio),
          url: id ? '' : opts.url,
          player: player
        });
      }, opts.time);
    }
  });
}
