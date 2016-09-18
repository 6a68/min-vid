const getVideoId = require('get-video-id');
const qs = require('sdk/querystring');
const { getActiveView } = require('sdk/view/core');
const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

module.exports = launchVideo;

// Pass in a video URL as opts.src or pass in a video URL lookup function as opts.getUrlFn
function launchVideo(opts, panel) {
  if (!panel) throw new Error('panel needs to be provided as second argument');
  // opts {url: url,
  //       getUrlFn: getYouTubeUrl,
  //       domain: 'youtube.com',
  //       src: streamURL or ''}
  let id;

  // TODO: submit a fix to getVideoId for this. #226
  if (opts.url.indexOf('attribution_link') > -1) {
    id = getIdFromAttributionLink(opts.url);
  } else {
    id = getVideoId(opts.url);
  }

  // To avoid the panel disappearing when the opener is closed, attach it to
  // the hidden window.
  const hiddenWindow = Services.appShell.hiddenDOMWindow;
  function showPanel() {
    panel.show();
    // next, reattach the panel to the hidden window
    const xulPanel = getActiveView(panel);
    xulPanel.parentNode.removeChild(xulPanel);
    hiddenWindow.document.documentElement.appendChild(xulPanel);
    console.log('thing moved to hidden window');
  }

  panel.port.emit('set-video', {domain: opts.domain, id: id, src: opts.src || ''});
  showPanel();

  if (!opts.src) {
    opts.getUrlFn(id, function(err, streamUrl) {
      if (!err) {
        panel.port.emit('set-video', {src: streamUrl});
        showPanel();
      }
    });
  }
}

function getIdFromAttributionLink(url) {
  const matcher = 'attribution_link?';
  const idx = url.indexOf(matcher);
  const partialUrl = decodeURIComponent(url).substring(idx + matcher.length);
  const idMatcher = 'watch?';
  const idx2 = partialUrl.indexOf(idMatcher);
  return qs.parse(partialUrl.substring(idx2 + idMatcher.length)).v;
}
