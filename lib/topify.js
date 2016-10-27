/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the 'License'). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

// This library uses js-ctypes to force the minvid window to be topmost
// on linux/*BSD, windows, and mac systems.
//
// This library is partially derived from MPL 2.0-licensed code available at
// https://github.com/Noitidart/Topick.

/* global Services */
const { Cu, Ci } = require('chrome');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/ctypes.jsm');

Cu.import('chrome://minvid-ostypes/content/cutils.jsm');

let platform;
let unsupportedPlatform;

function _initPlatformCode() {
  // Platforms we support. gtk includes unix-like systems.
  const platforms = {
    windows:  'chrome://minvid-ostypes/content/ostypes_win.jsm',
    gtk:    'chrome://minvid-ostypes/content/ostypes_x11.jsm',
    cocoa: 'chrome://minvid-ostypes/content/ostypes_mac.jsm'
  };

  let wm = Services.appinfo.widgetToolkit.toLowerCase();
  platform = (wm.indexOf('gtk') === 0) ? 'gtk' : wm;

  if (platform in platforms) Cu.import(platforms[platform]);
  else unsupportedPlatform = true;
}
_initPlatformCode();

// topify tries to make the provided domWindow topmost, using platform-specific code.
// Returns true if successful.
function topify(domWindow) {
  if (unsupportedPlatform) return console.error(`Unable to topify minvid window on unsupported window toolkit ${platform}.`);

  const winPtrStr = _getNativeHandlePtrStr(domWindow);
  if (!winPtrStr) return console.error('Unable to get native pointer for window.');

  if (platform === 'windows')    return _winntTopify(winPtrStr);
  else if (platform === 'cocoa') return _macTopify(winPtrStr);
  else if (platform === 'gtk')   return _nixTopify(winPtrStr);
}

// Given an nsIDOMWindow, return a string pointer to the native window.
function _getNativeHandlePtrStr(domWindow) {
  const baseWindow = domWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIWebNavigation)
                      .QueryInterface(Ci.nsIDocShellTreeItem)
                      .treeOwner
                      .QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIBaseWindow);
  return baseWindow.nativeHandle;
}

// TODO: why would this function break the window reference held by the addon code?
function _winntTopify(winPtrStr) {
  const winPtr = ctypes.voidptr_t(ctypes.UInt64(winPtrStr));
  const didTopify = ostypes.API('SetWindowPos')(winPtr, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOSIZE | ostypes.CONST.SWP_NOMOVE);
  return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);
}

function _macTopify(winPtrStr) {
  const floatingWindowLevel = ostypes.API('CGWindowLevelForKey')(ostypes.CONST.kCGFloatingWindowLevelKey);
  const winPtr = ostypes.TYPE.NSWindow(ctypes.UInt64(winPtrStr));
  const didTopify = ostypes.API('objc_msgSend')(winPtr, ostypes.HELPER.sel('setLevel:'), ostypes.TYPE.NSInteger(floatingWindowLevel));
  return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);
}

function _nixTopify(winPtrStr) {
  // I had been using this:

  // based on https://github.com/6a68/min-vid/commit/1e451fb#commitcomment-19478389
  //const gtkWinPtr = ostypes.HELPER.gdkWinPtrToGtkWinPtr(ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(winPtrStr)));
  //const didTopify = ostypes.API('gtk_window_set_keep_above')(gtkWinPtr, true);
  //return didTopify ? true : console.error(`Unable to topify minvid window: ${ctypes.winLastError}`);

  // Noitidart suggested instead doing this, which passes 1 instead of true, I guess?
  const gdkWin = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(winPtrStr));
  const gtkWin = ostypes.HELPER.gdkWinPtrToGtkWinPtr(gdkWin);
  ostypes.API.gtk_window_set_keep_above(gtkWin, 1);
  
  return true;
  
  /*
  let ev = ostypes.TYPE.xcb_client_message_event_t();
  ev.response_type = ostypes.CONST.XCB_CLIENT_MESSAGE;
  let gdkWin = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(winPtrStr));
  ev.window = ostypes.HELPER.gdkWinPtrToXID(gdkWin);
  ev.format = 32;
  ev.data.data32[1] = ostypes.CONST.XCB_CURRENT_TIME;
  ev.type = ostypes.HELPER.cachedXCBAtom('_NET_WM_STATE');
  ev.data.data32[0] = ostypes.CONST._NET_WM_STATE_ADD;
  ev.data.data32[1] = ostypes.HELPER.cachedXCBAtom('_NET_WM_STATE_ABOVE');
  const didSendCookie = ostypes.API('xcb_send_event_checked')(ostypes.HELPER.cachedXCBConn(), 0, ostypes.HELPER.cachedXCBRootWindow(),
                              ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_REDIRECT | ostypes.CONST.XCB_EVENT_MASK_SUBSTRUCTURE_NOTIFY,
                              ctypes.cast(ev.address(), ctypes.char.ptr));
  const didSend = didSendCookieCheck.isNull();
  const didFlush = ostypes.API('xcb_flush')(ostypes.HELPER.cachedXCBConn());
  
  ostypes.HELPER.ifOpenedXCBConnClose(); // otherwise mem leak
  
  return !!didSend;
  */
}

module.exports = topify;
