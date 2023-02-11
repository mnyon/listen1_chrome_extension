/* eslint-disable no-param-reassign */
/* global isElectron getPlayer getPlayerAsync addPlayerListener getLocalStorageValue */

/* 
  和UI有关的控制部分.播放器的状态控制对象
*/
{
  /* 
    判断当前的运行环境
  */
  const mode =
    isElectron() || getLocalStorageValue('enable_stop_when_close', true)
      ? 'front'
      : 'background';

  const myPlayer = getPlayer(mode);
  /* 
    播放器的当前状态
    这个player似乎真的控制着音乐的播放问题
    这个Plater的意思似乎是UI上的Player,它只需要一个单例即可
  */
  const l1Player = {
    /* 
      仅仅是播放器的声音状态管理
    */
    status: {
      muted: myPlayer.muted,
      volume: myPlayer.volume * 100,
      loop_mode: myPlayer.loop_mode,
      playing: myPlayer.playing,
    },
    /* 

    */
    play() {
      getPlayerAsync(mode, (player) => {
        player.play();
      });
    },
    pause() {
      getPlayerAsync(mode, (player) => {
        player.pause();
      });
    },
    togglePlayPause() {
      getPlayerAsync(mode, (player) => {
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
      });
    },
    playById(id) {
      getPlayerAsync(mode, (player) => {
        player.playById(id);
      });
    },
    loadById(idx) {
      getPlayerAsync(mode, (player) => {
        player.loadById(idx);
      });
    },
    seek(per) {
      getPlayerAsync(mode, (player) => {
        player.seek(per);
      });
    },
    next() {
      getPlayerAsync(mode, (player) => {
        player.skip('next');
      });
    },
    prev() {
      getPlayerAsync(mode, (player) => {
        player.skip('prev');
      });
    },
    random() {
      getPlayerAsync(mode, (player) => {
        player.skip('random');
      });
    },
    setLoopMode(input) {
      getPlayerAsync(mode, (player) => {
        // eslint-disable-next-line no-param-reassign
        player.loop_mode = input;
      });
    },
    mute() {
      getPlayerAsync(mode, (player) => {
        player.mute();
      });
    },
    unmute() {
      getPlayerAsync(mode, (player) => {
        player.unmute();
      });
    },
    toggleMute() {
      getPlayerAsync(mode, (player) => {
        if (player.muted) player.unmute();
        else player.mute();
      });
    },
    setVolume(per) {
      getPlayerAsync(mode, (player) => {
        // eslint-disable-next-line no-param-reassign
        player.volume = per / 100;
      });
    },
    adjustVolume(increase) {
      getPlayerAsync(mode, (player) => {
        player.adjustVolume(increase);
      });
    },
    addTrack(track) {
      getPlayerAsync(mode, (player) => {
        player.insertAudio(track);
      });
    },
    insertTrack(track, to_track, direction) {
      getPlayerAsync(mode, (player) => {
        player.insertAudioByDirection(track, to_track, direction);
      });
    },
    removeTrack(index) {
      getPlayerAsync(mode, (player) => {
        player.removeAudio(index);
      });
    },
    addTracks(list) {
      getPlayerAsync(mode, (player) => {
        player.appendAudioList(list);
      });
    },
    clearPlaylist() {
      getPlayerAsync(mode, (player) => {
        player.clearPlaylist();
      });
    },
    setNewPlaylist(list) {
      getPlayerAsync(mode, (player) => {
        player.setNewPlaylist(list);
      });
    },
    getTrackById(id) {
      if (!l1Player.status.playlist) return null;
      return l1Player.status.playlist.find((track) => track.id === id);
    },
    /* 
      这个似乎和player_thread有关系,那里真的有player的Class定义
      这段代码是负责连接播放器并加载本地存储设置的逻辑。 
      它首先通过异步调用 getPlayerAsync() 获取播放器实例，如果播放器未正在播放，则会加载本地存储的设置，然后根据localPlayerSettings中nowplaying_track_id的值加载歌曲，然后发送 playlistEvent、playingEvent、loadEvent 事件。

    */
    connectPlayer() {
      getPlayerAsync(mode, (player) => {
        // 这是一个状态判断,不能简单的理解成一个XX是否存在,那就脱离了语境了
        if (!player.playing) {
          // load local storage settings
          if (!player.playlist.length) {
            const localCurrentPlaying =
              localStorage.getObject('current-playing');
            if (localCurrentPlaying !== null) {
              localCurrentPlaying.forEach((i) => {
                i.disabled = false;
              });
              player.setNewPlaylist(localCurrentPlaying);
            }
          }

          const localPlayerSettings = localStorage.getObject('player-settings');
          if (localPlayerSettings !== null) {
            player.loadById(localPlayerSettings.nowplaying_track_id);
          }
        }

        player.sendPlaylistEvent();
        player.sendPlayingEvent();
        player.sendLoadEvent();
      });
    },
  };

  /* 
    播放器本身是一个对象,但是现在的情况是它接受一个Angular控制器,从而控制UI
    现在从Angular的UI对象(相当于已经控制住HTML的对象)来和播放器Player绑定
  */
  l1Player.injectDirectives = (ngApp) => {
    // 从播放列表中播放内容
    ngApp.directive('playFromPlaylist', () => ({
      restrict: 'EA',
      scope: {
        song: '=playFromPlaylist',
      },
      link(scope, element) {
        element.bind('click', () => {
          // 这就是刚才Player自身的方法 传递的参数就是从UI传递进去的
          l1Player.playById(scope.song.id);
        });
      },
    }));

    // 播放下一首歌曲
    ngApp.directive('nextTrack', () => ({
      restrict: 'EA',
      link(scope, element) {
        element.bind('click', () => {
          l1Player.next();
        });
      },
    }));

    // 播放上一首歌曲
    ngApp.directive('prevTrack', () => ({
      restrict: 'EA',
      link(scope, element) {
        element.bind('click', () => {
          l1Player.prev();
        });
      },
    }));

    // 清空播放列表
    ngApp.directive('clearPlaylist', () => ({
      restrict: 'EA',
      link(scope, element) {
        element.bind('click', () => {
          l1Player.clearPlaylist();
        });
      },
    }));

    // 从个当中去除一首歌
    ngApp.directive('removeFromPlaylist', () => ({
      restrict: 'EA',
      scope: {
        song: '=removeFromPlaylist',
      },
      link(scope, element, attrs) {
        element.bind('click', () => {
          l1Player.removeTrack(attrs.index);
        });
      },
    }));

    // 暂停播放
    ngApp.directive('playPauseToggle', () => ({
      restrict: 'EA',
      link(scope, element) {
        element.bind('click', () => {
          l1Player.togglePlayPause();
        });
      },
    }));
  };

  /* 
    mode front back
    该代码用于处理一个名为addPlayerListener的函数，该函数接受两个参数：mode，以及一个匿名函数。
    在匿名函数中
    它首先检查msg中的类型是否为“BG_PLAYER:FRAME_UPDATE”
    如果是，则将msg.data中的内容添加到l1Player.status.playing对象中。
    随后，它检查msg的类型是否为“BG_PLAYER:PLAYLIST”，如果是，则将msg.data中的内容赋值给l1Player.status.playlist。
    最后，如果函数调用中传入了res参数，则调用res以执行操作。
  */
  addPlayerListener(mode, (msg, sender, res) => {
    if (msg.type === 'BG_PLAYER:FRAME_UPDATE') {
      /* 
        UI控制的播放器现在管理着所有的Tracks
      */
      l1Player.status.playing = {
        ...l1Player.status.playing,
        ...msg.data,
      };
    } else if (msg.type === 'BG_PLAYER:PLAYLIST') {
      l1Player.status.playlist = msg.data || [];
    }
    if (res !== undefined) {
      res();
    }
  });

  // 在全局的情况下绑定这个应用
  window.l1Player = l1Player;
}
