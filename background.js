var mainWindow = null;
var pending = null;
var upgrading = false;
var files = [];
var commands = [];

var openWindow = function() {
  
  //if window exists, re-use it
  if (mainWindow) {
    mainWindow.contentWindow.launchData = files;
    mainWindow.contentWindow.require(["command"], function(c) {
      c.fire("session:open-launch");
    });
    mainWindow.focus();
    mainWindow.drawAttention();
    files = [];
    pending = null;
    return;
  }
  
  //otherwise, open a new window
  var defaults = {
    width: 800,
    height: 600,
    left: 50,
    top: 50
  };
  chrome.app.window.create("main.html", {
      bounds: defaults,
      id: "caret:main"
  }, function(win) {
    mainWindow = win;
    win.contentWindow.launchData = files;
    win.contentWindow.launchCommands = commands;
    mainWindow.onClosed.addListener(function() {
      mainWindow = null;
      chrome.storage.local.remove("isOpen");
    });
    files = [];
    commands = [];
    pending = null;
    chrome.storage.local.set({isOpen: true});
  });
}

var launch = function(launchData) {
  
  if (launchData && launchData.items) files.push.apply(files, launchData.items);
  //we delay opening the actual window to give multiple file events time to fire
  if (pending !== null) return;
  if (upgrading) return;
  pending = setTimeout(openWindow, 250);
  
};

var onMessage = function(message, sender, sendResponse) {
  //main window will pick up the message, if it's open
  //we also allow extensions to suppress launch behavior for spurious messages
  if (mainWindow || message.quiet || !message.command) {
    //if it is open, and the command is loud enough, flash the window
    if (mainWindow && message.command && !message.quiet) {
      mainWindow.drawAttention();
    }
    return;
  }
  commands.push({
    message: message,
    sender: sender,
    sendResponse: sendResponse
  });
  if (pending !== null) return;
  if (upgrading) return;
  pending = setTimeout(openWindow, 250);
};

chrome.app.runtime.onLaunched.addListener(launch);

//We shouldn't always relaunch, only if a window was open at shutdown
chrome.app.runtime.onRestarted.addListener(function() {
  chrome.storage.local.get("isOpen", function(data) {
    if (data.isOpen) launch();
  });
});

chrome.runtime.onMessageExternal.addListener(onMessage);

// setup for app button menus

chrome.contextMenus.create({
  title: "Emergency Reset",
  contexts: [ "launcher" ],
  id: "app:factory-reset"
});

chrome.contextMenus.onClicked.addListener(function(data) {
  if (data.menuItemId != "app:factory-reset") return;
  if (mainWindow) mainWindow.close();
  var cleared = {
    local: false,
    sync: false
  };
  var check = function(storage) {
    cleared[storage] = true;
    if (cleared.local && cleared.sync) {
      chrome.notifications.create("app:factory-reset-complete", {
        type: "basic",
        iconUrl: "icon-128.png",
        title: "Emergency Reset Complete",
        message: "Caret has been reset to the default settings."
      }, function() {});
    }
  };
  chrome.storage.local.clear(check.bind(null, "local"));
  chrome.storage.sync.clear(check.bind(null, "sync"));
});