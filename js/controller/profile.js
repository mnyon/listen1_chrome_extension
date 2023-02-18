/* eslint-disable import/no-unresolved */
/* eslint-disable global-require */
/* eslint-disable no-undef */
/* eslint-disable no-param-reassign */
/* global angular i18next sourceList platformSourceList */
angular.module('listenone').controller('ProfileController', [
  '$scope',
  ($scope) => {
    // 默认语言
    let defaultLang = 'zh-CN';
    const supportLangs = ['zh-CN', 'en-US'];
    
    if (supportLangs.indexOf(navigator.language) !== -1) {
      defaultLang = navigator.language;
    }
    if (supportLangs.indexOf(localStorage.getObject('language')) !== -1) {
      defaultLang = localStorage.getObject('language');
    }
    $scope.lastestVersion = '';
    $scope.theme = '';
    $scope.proxyModes = [
      { name: 'system', displayId: '_PROXY_SYSTEM' },
      { name: 'direct', displayId: '_PROXY_DIRECT' },
      { name: 'custom', displayId: '_PROXY_CUSTOM' },
    ];

    [$scope.proxyModeInput] = $scope.proxyModes;
    [$scope.proxyMode] = $scope.proxyModes;
    $scope.proxyProtocols = ['http', 'https', 'quic', 'socks4', 'socks5'];

    $scope.proxyProtocol = 'http';
    $scope.proxyRules = '';

    $scope.changeProxyProtocol = (newProtocol) => {
      $scope.proxyProtocol = newProtocol;
    };

    $scope.changeProxyMode = (newMode) => {
      $scope.proxyModeInput = newMode;
    };

    /* 
      设置代理配置。
      它首先获取代理模式，然后从文档中获取主机和端口，然后将它们设置为代理规则。
      如果代理模式是系统或直接，则发送一条消息以更新代理配置，否则发送另一条消息，使用代理规则更新代理配置。
    */
    $scope.setProxyConfig = () => {
      const mode = $scope.proxyModeInput.name;
      $scope.proxyMode = $scope.proxyModeInput;
      const host = document.getElementById('proxy-rules-host').value;
      const port = document.getElementById('proxy-rules-port').value;
      $scope.proxyRules = `${$scope.proxyProtocol}://${host}:${port}`;
      if (isElectron()) {
        const message = 'update_proxy_config';
        const { ipcRenderer } = require('electron');
        if (mode === 'system' || mode === 'direct') {
          ipcRenderer.send('control', message, { mode });
        } else {
          ipcRenderer.send('control', message, {
            proxyRules: $scope.proxyRules,
          });
        }
      }
    };

    $scope.getProxyConfig = () => {
      if (isElectron()) {
        // get proxy config from main process
        const message = 'get_proxy_config';
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('control', message);
      }
    };

    /* 
      检查最新的版本
    */
    $scope.initProfile = () => {
      const url = `https://api.github.com/repos/listen1/listen1_chrome_extension/releases/latest`;
      axios.get(url).then((response) => {
        $scope.lastestVersion = response.data.tag_name;
      });

      $scope.getProxyConfig();
    };


    /* 

    */
    if (isElectron()) {
      // Require只能在类Node环境中使用
      const { ipcRenderer } = require('electron');

      // 事件监听
      ipcRenderer.on('proxyConfig', (event, config) => {
        // parse config
        if (config.mode === 'system' || config.mode === 'direct') {
          [$scope.proxyMode] = $scope.proxyModes.filter(
            (i) => i.name === config.mode
          );
          $scope.proxyModeInput = $scope.proxyMode;
          $scope.proxyRules = '';
        } else {
          [$scope.proxyMode] = $scope.proxyModes.filter(
            (i) => i.name === 'custom'
          );
          $scope.proxyModeInput = $scope.proxyMode;
          $scope.proxyRules = config.proxyRules;
          // rules = 'socks5://127.0.0.1:1080'
          const match = /(\w+):\/\/([\d.]+):(\d+)/.exec(config.proxyRules);
          const [, protocol, host, port] = match;

          $scope.proxyProtocol = protocol;
          document.getElementById('proxy-rules-host').value = host;
          document.getElementById('proxy-rules-port').value = port;
        }
      });
    }


    /**
     * 设定国际化语言
     *
     * @param {*} langKey
     */
    $scope.setLang = (langKey) => {
      // You can change the language during runtime
      i18next.changeLanguage(langKey).then((t) => {
        axios.get('i18n/zh-CN.json').then((res) => {
          Object.keys(res.data).forEach((key) => {
            $scope[key] = t(key);
          });
          sourceList.forEach((item) => {
            item.displayText = t(item.displayId);
          });
          platformSourceList.forEach((item) => {
            item.displayText = t(item.displayId);
          });
          $scope.proxyModes.forEach((item) => {
            item.displayText = t(item.displayId);
          });
        });
        localStorage.setObject('language', langKey);
      });
    };

    // 这种脚本的划分方式就是过程式的,所以才会出现又有定义又有执行
    $scope.setLang(defaultLang);

    let defaultTheme = 'white';
    if (localStorage.getObject('theme') !== null) {
      defaultTheme = localStorage.getObject('theme');
    }

    /**
     * 更换主题 
     *
     * @param {string} theme类型
     */
    $scope.setTheme = (theme) => {
      // 全局状态设定
      $scope.theme = theme;

      // 准备所有主题资源 CSS file 在这里注册可以用的主题颜色
      const themeFiles = {
        white: ['css/iparanoid.css', 'css/common.css'],
        black: ['css/origin.css', 'css/common.css'],
        white2: ['css/iparanoid2.css', 'css/common2.css'],
        black2: ['css/origin2.css', 'css/common2.css'],
      };
      // You can change the language during runtime
      // 检查传递的参数是否有对应的注意注册
      if (themeFiles[theme] !== undefined) {
        const keys = ['theme-css', 'common-css'];
        for (let i = 0; i < themeFiles[theme].length; i += 1) {
          document.getElementById(keys[i]).href = themeFiles[theme][i];
        }
        localStorage.setObject('theme', theme);
      }
      axios.get('images/feather-sprite.svg').then((res) => {
        document.getElementById('feather-container').innerHTML = res.data;
      });
    };

    $scope.setTheme(defaultTheme);

  },
]);
