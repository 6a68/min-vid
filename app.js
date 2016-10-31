const React = require('react');
const ReactDOM = require('react-dom');
const AppView = require('./components/app-view');

const emitter = require('./client-lib/emitter.js');

// global listeners
require('./client-lib/nsa');

const defaultData = require('./client-lib/defaults');

window.AppData = new Proxy(defaultData, {
  set: function(obj, prop, value) {
    if (prop === 'strings') {
      try {
        obj[prop] = JSON.parse(value);
      } catch (ex) {
        window.console.error('Unable to parse l10n strings: ', ex);
      }
    } else obj[prop] = value;

    // if (prop === 'src' && obj.player) {
    //   emitter.emit('reset');
    // }
    renderApp();
    return true;
  }
});

window.onresize = () => {
  emitter.emit('resize', {
    width: window.AppData.width = document.body.clientWidth,
    height: window.AppData.height = document.body.clientHeight
  });
};

window.pendingCommands = [];

window.resetCommands = function() {
  // setting this from the addon seems to create an obj, not an array
  window.pendingCommands = [];
};

function renderApp() {
  ReactDOM.render(React.createElement(AppView, window.AppData),
                  document.getElementById('container'));
}
