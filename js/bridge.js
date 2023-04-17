/* eslint-disable no-unused-vars */

/*
  build a bridge between UI and audio player
  audio player has 2 modes, but share same protocol: front and background.
  * front: audio player and UI are in same environment
  * background: audio player is in background page.
*/

/* 
  UI控制PLayer
*/
function getFrontPlayer() {
  // player_thread
  return window.threadPlayer;
}

/* 
  Audio控制Player
*/
function getBackgroundPlayer() {
  return chrome.extension.getBackgroundPage().threadPlayer;
}

/* 
  获取对Audio的控制Player 异步方法
*/
function getBackgroundPlayerAsync(callback) {
  (chrome || browser).runtime.getBackgroundPage((w) => {
    callback(w.threadPlayer);
  });
}

/* 
  获取播放器的实例
*/
function getPlayer(mode) {
  if (mode === 'front') {
    return getFrontPlayer();
  }
  if (mode === 'background') {
    return getBackgroundPlayer();
  }
  return undefined;
}

/* 
  这个函数接受两个参数：一个模式和一个回调函数。 
  如果模式是“前”，它将调用'getFrontPlayer'函数，然后使用返回的玩家对象作为参数调用回调函数。
  如果模式是“背景”，它将调用'getBackgroundPlayerAsync'
  它接受一个回调函数参数，当异步调用完成时将被调用，并使用异步调用的结果作为参数调用回调函数。
*/
function getPlayerAsync(mode, callback) {
  if (mode === 'front') {
    const player = getFrontPlayer();
    return callback(player);
  }
  if (mode === 'background') {
    return getBackgroundPlayerAsync(callback);
  }
  return undefined;
}

/* 
  似乎是某种播放列表
*/
const frontPlayerListener = [];

/* 
  TODO listener的参数
*/
function addFrontPlayerListener(listener) {
  frontPlayerListener.push(listener);
}

/* 
  TODO 检查这个参数 
*/
function addBackgroundPlayerListener(listener) {
  return (chrome || browser).runtime.onMessage.addListener(
    (msg, sender, res) => {
      if (!msg.type.startsWith('BG_PLAYER:')) {
        return null;
      }
      return listener(msg, sender, res);
    }
  );
}

/* 
  这个监听的事件非常的神奇
*/
function addPlayerListener(mode, listener) {
  if (mode === 'front') {
    /* 
      直接把Item压进去
    */
    return addFrontPlayerListener(listener);
  }
  if (mode === 'background') {
    return addBackgroundPlayerListener(listener);
  }
  return null;
}

/* 
  message就是一个track 并且携带着暂停和播放等状态
*/
function frontPlayerSendMessage(message) {
  if (frontPlayerListener !== []) {
    frontPlayerListener.forEach((listener) => {
      /* 
        这是一个howler的方法
      */
      listener(message);
    });
  }
}

/* 
  TODO 针对Background的信息的message内容
*/
function backgroundPlayerSendMessage(message) {
  (chrome || browser).runtime.sendMessage(message);
}

/* 
  这里传递的message就是一首trackObject 
  但是核心是如果播放核心已经暂停了,那么UI部分应该跟着改变
  这相当于一个UI的状态同步,其中的message实际上就是一个事件
*/
function playerSendMessage(mode, message) {
  if (mode === 'front') {
    frontPlayerSendMessage(message);
  }
  if (mode === 'background') {
    backgroundPlayerSendMessage(message);
  }
}
