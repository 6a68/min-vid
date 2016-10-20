/* global Services */
const { Cu } = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');

const self = require("sdk/self");
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { setTimeout, clearTimeout } = require('sdk/timers');
const sendMetricsData = require('./send-metrics-data');
const topify = require('./topify.js');
const DraggableElement = require('./dragging-utils.js');

const DEFAULT_DIMENSIONS = {
  height: 180,
  width: 320,
  minimizedHeight: 40
};


let mvWindow;

let commandPollTimer;

// waits till the window is ready, then calls callbacks.
function whenReady(cb) {
  // TODO: instead of setting timeout for each callback, just poll, then call all callbacks.
  if (mvWindow &&
      'AppData' in mvWindow.wrappedJSObject &&
      'YT' in mvWindow.wrappedJSObject &&
      'PlayerState' in mvWindow.wrappedJSObject.YT) return cb();
  setTimeout(() => { whenReady(cb) }, 25);
}

// I can't get frame scripts working, so instead we just set global state directly in react. fml
function send(eventName, msg) {
  whenReady(() => {
    const newData = Object.assign(mvWindow.wrappedJSObject.AppData, msg);
    mvWindow.wrappedJSObject.AppData = newData;
  });
}

function getWindow() {
  return mvWindow;
}

function closeWindow() {
  // stop communication
  clearTimeout(commandPollTimer);
  // close window
  mvWindow.close();
  // TODO: do we need to manually tear down frame scripts?
  mvWindow = null;
}

function create() {
  console.log('create window');
  if (mvWindow) return mvWindow;

  const window = getMostRecentBrowserWindow();
  // implicit assignment to mvWindow global
  mvWindow = window.open(self.data.url('default.html'), 'minvid',
                         'chrome,dialog=no,width=320,height=180,titlebar=no,alwaysRaised');
  // once the window's ready, make it always topmost
  whenReady(() => { topify(mvWindow); });
  initCommunication();
  whenReady(() => { makeDraggable(); });
  return mvWindow;
}

function initCommunication() {
  console.log('initCommunication window');
  let errorCount = 0;
  // When the window's ready, start polling for pending commands
  function pollForCommands() {
    let cmd;
    try {
      cmd = mvWindow.wrappedJSObject.pendingCommands;
    } catch (ex) {
      console.error('something happened trying to get pendingCommands: ', ex);
      if (++errorCount > 10) {
        console.error('pendingCommands threw 10 times, giving up');
        // NOTE: if we can't communicate with the window, we have to close it,
        // since the user cannot.
        closeWindow();
        return;
      }
    }
    commandPollTimer = setTimeout(pollForCommands, 25);
    if (!cmd || !cmd.length) return;
    // We found a command! Erase it, then act on it.
    console.log('found commands!', cmd);
    mvWindow.wrappedJSObject.resetCommands();
    for (let i = 0; i < cmd.length; i++) {
      let parsed;
      try {
        parsed = JSON.parse(cmd[i]);
      } catch (ex) {
        console.error('malformed command send to addon: ', c, ex);
        break;
      }
      handleMessage(parsed);
    }
  }
  whenReady(pollForCommands);
}

let dragBindingAlive = true;
// TODO: make sure bug 615152 doesn't break anything, if we decide to keep the drag handle
// I think we don't need it now.
function makeDraggable() {
  // Based on WindowDraggingElement usage in popup.xml
  // https://dxr.mozilla.org/mozilla-central/source/toolkit/content/widgets/popup.xml#278-288
  try {
    let draghandle = DraggableElement(mvWindow);
    // TODO: should the mouseDownCheck actually just verify that mvWindow is truthy?
    draghandle.mouseDownCheck = () => { return dragBindingAlive; };
  // TODO: why does the WindowDraggingElement code wrap calls in try/catch like this?
  } catch (ex) { console.error(ex); }
}

function destroy() {
  if (!mvWindow) return;
  closeWindow();
}

function updateWindow() {
  return mvWindow || create();
}

function show() {
  if (!mvWindow) create();
}

function handleMessage(msg) {
  console.log('handleMessage: ', msg);
  const title = msg.action;
  const opts = msg;
  if (title === 'send-to-tab') {
    const pageUrl = getPageUrl(opts.domain, opts.id, opts.time);
    if (pageUrl) require('sdk/tabs').open(pageUrl);
    else {
      console.error('could not parse page url for ', opts); // eslint-disable-line no-console
      send('set-video', {error: 'Error loading video from ' + opts.domain});
    }
    send('set-video', {domain: '', src: ''});
    closeWindow();
  } else if (title === 'close') {
    send('set-video', {domain: '', src: ''});
    closeWindow();
  } else if (title === 'minimize') {
    mvWindow.resizeTo(DEFAULT_DIMENSIONS.width, DEFAULT_DIMENSIONS.minimizedHeight);
    mvWindow.moveBy(0, DEFAULT_DIMENSIONS.height - DEFAULT_DIMENSIONS.minimizedHeight);
  } else if (title === 'maximize') {
    mvWindow.resizeTo(DEFAULT_DIMENSIONS.width, DEFAULT_DIMENSIONS.height);
    mvWindow.moveBy(0, DEFAULT_DIMENSIONS.minimizedHeight - DEFAULT_DIMENSIONS.height);
  } else if (title === 'metrics-event') {
    // Note: sending in the window ref to avoid circular imports.
    sendMetricsData(opts.payload, mvWindow);
  }
}

function getPageUrl(domain, id, time) {
  let url;
  if (domain.indexOf('youtube') > -1) {
    url = `https://youtube.com/watch?v=${id}&t=${Math.floor(time)}`;
  } else if (domain.indexOf('vimeo') > -1) {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time - min * 60);
    url = `https://vimeo.com/${id}#t=${min}m${sec}s`;
  } else if (domain.indexOf('vine') > -1) {
    url = `https://vine.co/v/${id}`;
  }

  return url;
}

module.exports = {
  whenReady: whenReady,
  create: create,
  destroy: destroy,
  getWindow: getWindow,
  updateWindow: updateWindow,
  // replaces panel.port.emit
  send: send,
  // replaces panel.show
  show: show
};
