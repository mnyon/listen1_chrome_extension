/**
 * Get and send oauth tokens from query string.
 */


/* 
  这段代码用于发送消息给 Chrome 扩展程序，其中包含了当前窗口的查询参数“code”的值。该消息可以用于执行一些操作，例如打开新窗口或关闭当前窗口。
*/
chrome.runtime.sendMessage(
  {
    type: 'code',
    code: new URLSearchParams(window.location.search).get('code'),
  },
  // eslint-disable-next-line no-unused-vars
  (response) => {
    // window.open('', '_self', '');
    // window.close();
  }
);
