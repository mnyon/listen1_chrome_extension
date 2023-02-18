/* global async LRUCache setPrototypeOfLocalStorage getLocalStorageValue */
/* global netease xiami qq kugou kuwo bilibili migu taihe localmusic myplaylist */

const PROVIDERS = [
  /* 
    此处的instance不是一个什么Object,可能就是一个Class
  */
  {
    name: 'netease',
    instance: netease,
    searchable: true,
    support_login: true,
    id: 'ne',
  },
  {
    name: 'xiami',
    instance: xiami,
    searchable: false,
    hidden: true,
    support_login: false,
    id: 'xm',
  },
  {
    name: 'qq',
    instance: qq,
    searchable: true,
    support_login: true,
    id: 'qq',
  },
  {
    name: 'kugou',
    instance: kugou,
    searchable: true,
    support_login: false,
    id: 'kg',
  },
  {
    name: 'kuwo',
    instance: kuwo,
    searchable: true,
    support_login: false,
    id: 'kw',
  },
  {
    name: 'bilibili',
    instance: bilibili,
    searchable: true,
    support_login: false,
    id: 'bi',
  },
  {
    name: 'migu',
    instance: migu,
    searchable: true,
    support_login: true,
    id: 'mg',
  },
  {
    name: 'taihe',
    instance: taihe,
    searchable: true,
    support_login: false,
    id: 'th',
  },

/*   {
    name: 'easyfm',
    instance: easyfm,
    searchable: true,
    support_login: false,
    id: 'easyf',
  }, */

  {
    name: 'localmusic',
    instance: localmusic,
    searchable: false,
    hidden: true,
    support_login: false,
    id: 'lm',
  },
  {
    name: 'myplaylist',
    instance: myplaylist,
    searchable: false,
    hidden: true,
    support_login: false,
    id: 'my',
  },
];

/* 
  提供一些公共方法,直接暴露出来.
*/

/* 
  传递一个字符串,返回一个对应Object
  直接从名字取一个Provider
*/
function getProviderByName(sourceName) {
  /* 这里实际上使用的都是Class的静态方法,也就是说这些Provider完全没有实例化的意思,约定每个Class都提供标准接口. */
  return (PROVIDERS.find((i) => i.name === sourceName) || {}).instance;
}

function getAllProviders() {
  return PROVIDERS.filter((i) => !i.hidden).map((i) => i.instance);
}

/* 
  提供了搜索的接口的那些Provider
*/
function getAllSearchProviders() {
  return PROVIDERS.filter((i) => i.searchable).map((i) => i.instance);
}

/* 

*/
function getProviderNameByItemId(itemId) {
  const prefix = itemId.slice(0, 2);
  return (PROVIDERS.find((i) => i.id === prefix) || {}).name;
}

/* 
  对每个JSON的歌单的Item进行分析
*/
function getProviderByItemId(itemId) {
  /* 
    似乎歌单是自己的歌单的话就会返回my
  */
  const prefix = itemId.slice(0, 2);
  /* 
    看看这个歌单是不是几个平台的情况
  */
  return (PROVIDERS.find((i) => i.id === prefix) || {}).instance;
}

/* cache for all playlist request except myplaylist and localmusic */
const playlistCache = new LRUCache({
  max: 100,
  maxAge: 60 * 60 * 1000, // 1 hour cache expire
});

/* 
  将搜索框的内容格式化
*/
function queryStringify(options) {
  const query = JSON.parse(JSON.stringify(options));
  return new URLSearchParams(query).toString();
}

setPrototypeOfLocalStorage();

/* 暴露出来的封装对象,对外就是使用MediaService */

// eslint-disable-next-line no-unused-vars
const MediaService = {
  getLoginProviders() {
    return PROVIDERS.filter((i) => !i.hidden && i.support_login);
  },

  /**
   * 搜索服务配合搜索的内容进行搜索请求的准备,这里的搜索是针对UIplayer的
   *
   * @param {string} 目标平台的API source
   * @param {string} 搜索的内容 options
   * @return {object}  
   */
  search(source, options) {
    // 格式化搜索的内容
    const url = `/search?${queryStringify(options)}`;
    // 从所有的源中获取搜索信息
    if (source === 'allmusic') {
      // search all platform and merge result
      // 获取每个Provider的搜索结果 这种连续的箭头函数是特殊的函数式编程 柯里化
      const callbackArray = getAllSearchProviders().map((p) => (fn) => {
        // 匿名函数Callback参数中传递进去另一个匿名函数
        p.search(url).success((r) => {
          fn(null, r);
        });
      });
      return {
        success: (fn) =>
          async.parallel(callbackArray, (err, platformResultArray) => {
            // TODO: nicer pager, playlist support
            const result = {
              result: [],
              total: 1000,
              type: platformResultArray[0].type,
            };
            // 
            const maxLength = Math.max(
              ...platformResultArray.map((elem) => elem.result.length)
            );
            // 
            for (let i = 0; i < maxLength; i += 1) {
              platformResultArray.forEach((elem) => {
                if (i < elem.result.length) {
                  result.result.push(elem.result[i]);
                }
              });
            }
            // 
            return fn(result);
          }),
      };
    }

    // 只从特定的源中获取信息
    const provider = getProviderByName(source);
    /* 
      一个provider必须提供搜索功能,但是fm电台是没有搜索的.
      返回的结果是执行这个函数之后返回了一个Object
    */
    return provider.search(url);
  },

  showMyPlaylist() {
    return myplaylist.show_myplaylist('my');
  },

  showPlaylistArray(source, offset, filter_id) {
    const provider = getProviderByName(source);
    const url = `/show_playlist?${queryStringify({ offset, filter_id })}`;
    return provider.show_playlist(url);
  },

  getPlaylistFilters(source) {
    const provider = getProviderByName(source);
    return provider.get_playlist_filters();
  },

  /* 
    获取歌词,依赖Provider提供的获取歌词方法
  */
  getLyric(track_id, album_id, lyric_url, tlyric_url) {
    const provider = getProviderByItemId(track_id);
    const url = `/lyric?${queryStringify({
      track_id,
      album_id,
      lyric_url,
      tlyric_url,
    })}`;
    return provider.lyric(url);
  },

  showFavPlaylist() {
    return myplaylist.show_myplaylist('favorite');
  },

  queryPlaylist(listId, type) {
    const result = myplaylist.myplaylist_containers(type, listId);
    return {
      success: (fn) => fn({ result }),
    };
  },

  /* 
    当点击一个列表的时候获取歌单的内容
    listID应该就是在JSON中保存的每个歌单的ID
  */
  getPlaylist(listId, useCache = true) {
    
    const provider = getProviderByItemId(listId);
    const url = `/playlist?list_id=${listId}`;
    /* 
      似乎是命中本地缓存的意思
    */
    let hit = null;
    /* 
      什么东西的缓存?
    */
    if (useCache) {
      hit = playlistCache.get(listId);
    }

    /* 
      这也是一个函数出口 但是不清楚什么命中了
    */
    if (hit) {
      return {
        success: (fn) => fn(hit),
      };
    }
    /* 
      这是一种相当特殊的意图,返回对象后因为带有一个方法
      这个success接受一个函数为参数
      不仅如此，这个函数还自己接受一个Event的参数 但是这里完全看不出来
    */
    return {
      success: (fn) =>
        provider.get_playlist(url).success((playlist) => {
          if (provider !== myplaylist && provider !== localmusic) {
            playlistCache.set(listId, playlist);
          }
          /* 这个地方才能真正发现传递的data是什么，从外部是完全看不出来的 */
          fn(playlist);
        }),
    };
  },

  clonePlaylist(id, type) {
    const provider = getProviderByItemId(id);
    const url = `/playlist?list_id=${id}`;
    return {
      success: (fn) => {
        provider.get_playlist(url).success((data) => {
          myplaylist.save_myplaylist(type, data);
          fn();
        });
      },
    };
  },

  /* 
    删除自己的歌单
  */
  removeMyPlaylist(id, type) {
    myplaylist.remove_myplaylist(type, id);
    return {
      success: (fn) => fn(),
    };
  },

  /* 
    增加自己的歌单
  */
  addMyPlaylist(id, track) {
    const newPlaylist = myplaylist.add_track_to_myplaylist(id, track);
    return {
      success: (fn) => fn(newPlaylist),
    };
  },
  insertTrackToMyPlaylist(id, track, to_track, direction) {
    const newPlaylist = myplaylist.insert_track_to_myplaylist(
      id,
      track,
      to_track,
      direction
    );
    return {
      success: (fn) => fn(newPlaylist),
    };
  },
  /* 
    是添加这个歌曲到歌单吗?
  */
  addPlaylist(id, tracks) {
    const provider = getProviderByItemId(id);
    return provider.add_playlist(id, tracks);
  },

  removeTrackFromMyPlaylist(id, track) {
    myplaylist.remove_track_from_myplaylist(id, track);
    return {
      success: (fn) => fn(),
    };
  },

  removeTrackFromPlaylist(id, track) {
    const provider = getProviderByItemId(id);
    return provider.remove_from_playlist(id, track);
  },

  createMyPlaylist(title, track) {
    myplaylist.create_myplaylist(title, track);
    return {
      success: (fn) => {
        fn();
      },
    };
  },
  insertMyplaylistToMyplaylists(
    playlistType,
    playlistId,
    toPlaylistId,
    direction
  ) {
    const newPlaylists = myplaylist.insert_myplaylist_to_myplaylists(
      playlistType,
      playlistId,
      toPlaylistId,
      direction
    );
    return {
      success: (fn) => fn(newPlaylists),
    };
  },
  editMyPlaylist(id, title, coverImgUrl) {
    myplaylist.edit_myplaylist(id, title, coverImgUrl);
    return {
      success: (fn) => fn(),
    };
  },

  parseURL(url) {
    return {
      success: (fn) => {
        const providers = getAllProviders();
        Promise.all(
          providers.map(
            (provider) =>
              new Promise((res, rej) =>
                provider.parse_url(url).success((r) => {
                  if (r !== undefined) {
                    return rej(r);
                  }
                  return res(r);
                })
              )
          )
        )
          .then(() => fn({}))
          .catch((result) => fn({ result }));
      },
    };
  },

  /* 
    这段代码用于合并两个播放列表（source和target）。
    它首先从存储中获取target播放列表的数据，然后检查source播放列表中是否有相同的曲目，如果没有，它将添加到source播放列表中。最后，它将返回一个成功函数，以确保曲目添加成功。

    这的localStorage就是最终的JSONfile的内容
  */
  mergePlaylist(source, target) {
    const tarData = localStorage.getObject(target).tracks;
    const srcData = localStorage.getObject(source).tracks;
    tarData.forEach((tarTrack) => {
      if (!srcData.find((srcTrack) => srcTrack.id === tarTrack.id)) {
        myplaylist.add_track_to_myplaylist(source, tarTrack);
      }
    });
    return {
      success: (fn) => fn(),
    };
  },

  /* 
    不知道为什么开始播放之后就会触发这个
    MediaService.bootstrapTrack 挂载情况
  */
  bootstrapTrack(track, playerSuccessCallback, playerFailCallback) {
    const successCallback = playerSuccessCallback;
    const sound = {};
    function failureCallback() {
      if (localStorage.getObject('enable_auto_choose_source') === false) {
        playerFailCallback();
        return;
      }
      const trackPlatform = getProviderNameByItemId(track.id);
      const failover_source_list = getLocalStorageValue(
        'auto_choose_source_list',
        ['kuwo', 'qq', 'migu']
      ).filter((i) => i !== trackPlatform);

      const getUrlPromises = failover_source_list.map(
        (source) =>
          new Promise((resolve, reject) => {
            if (track.source === source) {
              // come from same source, no need to check
              resolve();
              return;
            }
            // TODO: better query method
            const keyword = `${track.title} ${track.artist}`;
            const curpage = 1;
            const url = `/search?keywords=${keyword}&curpage=${curpage}&type=0`;
            const provider = getProviderByName(source);
            provider.search(url).success((data) => {
              for (let i = 0; i < data.result.length; i += 1) {
                const searchTrack = data.result[i];
                // compare search track and track to check if they are same
                // TODO: better similar compare method (duration, md5)
                if (
                  !searchTrack.disable &&
                  searchTrack.title === track.title &&
                  searchTrack.artist === track.artist
                ) {
                  provider.bootstrap_track(
                    searchTrack,
                    (response) => {
                      sound.url = response.url;
                      sound.bitrate = response.bitrate;
                      sound.platform = response.platform;
                      reject(sound); // Use Reject to return immediately
                    },
                    resolve
                  );
                  return;
                }
              }
              resolve(sound);
            });
          })
      );
      // TODO: Use Promise.any() in ES2021 replace the tricky workaround
      Promise.all(getUrlPromises)
        .then(playerFailCallback)
        .catch((response) => {
          playerSuccessCallback(response);
        });
    }

    const provider = getProviderByName(track.source);

    provider.bootstrap_track(track, successCallback, failureCallback);
  },

  login(source, options) {
    const url = `/login?${queryStringify(options)}`;
    const provider = getProviderByName(source);

    return provider.login(url);
  },
  getUser(source) {
    const provider = getProviderByName(source);
    return provider.get_user();
  },
  getLoginUrl(source) {
    const provider = getProviderByName(source);
    return provider.get_login_url();
  },
  getUserCreatedPlaylist(source, options) {
    const provider = getProviderByName(source);
    const url = `/get_user_create_playlist?${queryStringify(options)}`;

    return provider.get_user_created_playlist(url);
  },

  getUserFavoritePlaylist(source, options) {
    const provider = getProviderByName(source);
    const url = `/get_user_favorite_playlist?${queryStringify(options)}`;

    return provider.get_user_favorite_playlist(url);
  },
  
  getRecommendPlaylist(source) {
    const provider = getProviderByName(source);

    return provider.get_recommend_playlist();
  },
  logout(source) {
    const provider = getProviderByName(source);

    return provider.logout();
  },
};

// eslint-disable-next-line no-unused-vars
const loWeb = MediaService;
