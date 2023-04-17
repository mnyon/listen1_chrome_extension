/* eslint-disable no-unused-vars */
/* global GithubClient */

const urls = [
  '*://*.music.163.com/*',
  '*://music.163.com/*',
  '*://*.xiami.com/*',
  '*://i.y.qq.com/*',
  '*://c.y.qq.com/*',
  '*://*.kugou.com/*',
  '*://*.kuwo.cn/*',
  '*://*.bilibili.com/*',
  '*://*.bilivideo.com/*',
  '*://*.bilivideo.cn/*',
  '*://*.migu.cn/*',
  '*://*.githubusercontent.com/*',
];

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30';

/* 
  点击插件的图标之后的行为
  1. 打开 listen1.html 页面
  2. 向 listen1.html 页面发送消息，告诉它当前页面的歌曲信息
  3. 监听 listen1.html 页面的消息，如果是播放歌曲的消息，则向当前页面发送消息，播放歌曲
*/
chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.create(
    {
      url: chrome.extension.getURL('listen1.html'),
    },
    (new_tab) => {
      // Tab opened.
    }
  );
});

/**
 * Get tokens.
 * Chrome扩展程序API中的一段，它从网页获取代码，并将其发送给Github客户端来处理。
 * 使用chrome.runtime.onMessage.addListener API来监听消息，并使用request变量来获取消息的信息。
 * 如果消息的类型为“code”，则调用GithubClient.github.handleCallback()方法来处理它，然后使用sendResponse()方法发送响应。
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== 'code') {
    return;
  }

  GithubClient.github.handleCallback(request.code);
  sendResponse();
});


/* 
  更改浏览器HTTP请求头的referer字段
*/
function hack_referer_header(details) {
  const replace_referer = true;
  let replace_origin = true;
  let add_referer = true;
  let add_origin = true;

  let referer_value = '';
  let origin_value = '';
  let ua_value = '';

  if (details.url.includes('://music.163.com/')) {
    referer_value = 'https://music.163.com/';
  }
  if (details.url.includes('://interface3.music.163.com/')) {
    referer_value = 'https://music.163.com/';
  }
  if (details.url.includes('://gist.githubusercontent.com/')) {
    referer_value = 'https://gist.githubusercontent.com/';
  }

  if (details.url.includes('.xiami.com/')) {
    add_origin = false;
    add_referer = false;
    // referer_value = "https://www.xiami.com";
  }

  if (details.url.includes('c.y.qq.com/')) {
    referer_value = 'https://y.qq.com/';
    origin_value = 'https://y.qq.com';
  }
  if (
    details.url.includes('i.y.qq.com/') ||
    details.url.includes('qqmusic.qq.com/') ||
    details.url.includes('music.qq.com/') ||
    details.url.includes('imgcache.qq.com/')
  ) {
    referer_value = 'https://y.qq.com/';
  }

  if (details.url.includes('.kugou.com/')) {
    referer_value = 'https://www.kugou.com/';
    ua_value = MOBILE_UA;
  }
  if (details.url.includes('m.kugou.com/')) {
    ua_value = MOBILE_UA;
  }
  if (details.url.includes('.kuwo.cn/')) {
    referer_value = 'https://www.kuwo.cn/';
  }

  if (
    details.url.includes('.bilibili.com/') ||
    details.url.includes('.bilivideo.com/')
  ) {
    referer_value = 'https://www.bilibili.com/';
    replace_origin = false;
    add_origin = false;
  }

  if (details.url.includes('.bilivideo.cn')) {
    referer_value = 'https://www.bilibili.com/';
    origin_value = 'https://www.bilibili.com/';
    add_referer = true;
    add_origin = true;
  }

  if (
    details.url.includes('.taihe.com/') ||
    details.url.includes('music.91q.com')
  ) {
    referer_value = 'https://music.taihe.com/';
  }

  if (details.url.includes('.migu.cn')) {
    referer_value = 'https://music.migu.cn/v3/music/player/audio?from=migu';
  }

  if (details.url.includes('m.music.migu.cn')) {
    referer_value = 'https://m.music.migu.cn/';
  }

  if (
    details.url.includes('app.c.nf.migu.cn') ||
    details.url.includes('d.musicapp.migu.cn')
  ) {
    ua_value = MOBILE_UA;
    add_origin = false;
    add_referer = false;
  }

  if (details.url.includes('jadeite.migu.cn')) {
    ua_value = 'okhttp/3.12.12';
    add_origin = false;
    add_referer = false;
  }
  /* 
    似乎需要添加新的来源的url
  */

  if (origin_value === '') {
    origin_value = referer_value;
  }

  let isRefererSet = false;
  let isOriginSet = false;
  let isUASet = false;
  const headers = details.requestHeaders;
  const blockingResponse = {};

  for (let i = 0, l = headers.length; i < l; i += 1) {
    if (
      replace_referer &&
      headers[i].name === 'Referer' &&
      referer_value !== ''
    ) {
      headers[i].value = referer_value;
      isRefererSet = true;
    }
    if (replace_origin && headers[i].name === 'Origin' && origin_value !== '') {
      headers[i].value = origin_value;
      isOriginSet = true;
    }
    if (headers[i].name === 'User-Agent' && ua_value !== '') {
      headers[i].value = ua_value;
      isUASet = true;
    }
  }

  if (add_referer && !isRefererSet && referer_value !== '') {
    headers.push({
      name: 'Referer',
      value: referer_value,
    });
  }

  if (add_origin && !isOriginSet && origin_value !== '') {
    headers.push({
      name: 'Origin',
      value: origin_value,
    });
  }

  if (!isUASet && ua_value !== '') {
    headers.push({
      name: 'User-Agent',
      value: ua_value,
    });
  }

  blockingResponse.requestHeaders = headers;
  return blockingResponse;
}

/* 
  添加一个Web请求的监听器
  如果chrome版本低于72（以上版本支持extraHeaders），则使用不支持extraHeaders参数的传统方法来添加监听器。
*/
function add_web_request_listener() {
  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      hack_referer_header,
      {
        urls,
      },
      ['requestHeaders', 'blocking', 'extraHeaders']
    );
  } catch (err) {
    // before chrome v72, extraHeader is not supported
    chrome.webRequest.onBeforeSendHeaders.addListener(
      hack_referer_header,
      {
        urls,
      },
      ['requestHeaders', 'blocking']
    );
  }
}

add_web_request_listener();



