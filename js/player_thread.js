/* eslint-disable no-underscore-dangle */
/* global MediaMetadata playerSendMessage MediaService */
/* global Howl Howler */
{
  /* 
    当前Sciript的作用是提供一个Player的实例,并且提供一些方法来操作这个实例
  */

  /**
   * Player class containing the state of our playlist and where we are in it.
   * Includes all methods for playing, skipping, updating the display, etc.
   * @param {Array} playlist Array of objects with playlist song details ({title, file, howl}).
   * 所以说Provider提供的可能不是mp3等等具体的细节,但是到了Player这里一定是了
   */
  class Player {
    constructor() {
      /* 
        当前的播放列表,实际上其中的每个item都是真实的trackAPI类似的返回结果
      */
      this.playlist = [];
      this._random_playlist = [];
      this.index = -1;
      this._loop_mode = 0;
      this._media_uri_list = {};
      this.playedFrom = 0;
      this.mode = 'background';
      this.skipTime = 15;
    }

    // 不能直接操作私有变量,所以使用共有方法来操作
    setMode(newMode) {
      this.mode = newMode;
    }

    // 某种刷新率
    setRefreshRate(rate = 10) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = setInterval(() => {
        if (this.playing) {
          this.sendFrameUpdate();
        }
      }, 1000 / rate);
    }

    // 获取当前播放列表的Object 
    get currentAudio() {
      return this.playlist[this.index];
    }

    // TODO 不清楚howl是怎么实例化和track相互结合的
    get currentHowl() {
      return this.currentAudio && this.currentAudio.howl;
    }

    // 操纵当前的howlObject来调节播放
    get playing() {
      return this.currentHowl ? this.currentHowl.playing() : false;
    }

    // eslint-disable-next-line class-methods-use-this
    get muted() {
      return !!Howler._muted;
    }

    /* 
      这段代码简单来说就是向播放列表中插入新的音频文件。
      它检查播放列表中是否有音频文件的ID，如果没有就创建一个新的audioData对象，将其中的属性设置为false， howl设置为null。
      如果有idx参数，则将音频文件插入idx位置，否则直接追加到播放列表中。然后发送播放列表和加载事件。
    */
    insertAudio(audio, idx) {
      if (this.playlist.find((i) => audio.id === i.id)) return;

      const audioData = {
        ...audio,
        disabled: false, // avoid first time load block
        howl: null,
      };
      if (idx) {
        this.playlist.splice(idx, 0, [audio]);
      } else {
        this.playlist.push(audioData);
      }
      this.sendPlaylistEvent();
      this.sendLoadEvent();
    }

    static array_move(arr, old_index, new_index) {
      // https://stackoverflow.com/questions/5306680/move-an-array-element-from-one-array-position-to-another
      if (new_index >= arr.length) {
        let k = new_index - arr.length + 1;
        while (k > 0) {
          k -= 1;
          arr.push(undefined);
        }
      }
      arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
      return arr; // for testing
    }

    insertAudioByDirection(audio, to_audio, direction) {
      const originTrack = this.playlist[this.index];
      const index = this.playlist.findIndex((i) => i.id === audio.id);
      let insertIndex = this.playlist.findIndex((i) => i.id === to_audio.id);
      if (index === insertIndex) {
        return;
      }
      if (insertIndex > index) {
        insertIndex -= 1;
      }
      const offset = direction === 'top' ? 0 : 1;
      this.playlist = Player.array_move(
        this.playlist,
        index,
        insertIndex + offset
      );
      const foundOriginTrackIndex = this.playlist.findIndex(
        (i) => i.id === originTrack.id
      );
      if (foundOriginTrackIndex >= 0) {
        this.index = foundOriginTrackIndex;
      }

      this.sendPlaylistEvent();
      this.sendLoadEvent();
    }

    /* 
      从播放列表中删除音频文件
    */
    removeAudio(idx) {
      if (!this.playlist[idx]) {
        return;
      }
      // restore playing status before change
      const isPlaying = this.playing;
      const { id: trackId } = this.currentAudio;

      if (isPlaying && this.playlist[idx].id === trackId) {
        this.pause();
      }

      this.playlist.splice(idx, 1);
      const newIndex = this.playlist.findIndex((i) => i.id === trackId);
      if (newIndex >= 0) {
        this.index = newIndex;
      } else {
        // current playing is deleted
        if (idx >= this.playlist.length) {
          this.index = this.playlist.length - 1;
        } else {
          this.index = idx;
        }
        if (isPlaying) {
          this.play();
        }
      }

      this.sendPlaylistEvent();
      this.sendLoadEvent();
    }

    /* 
      向播放列表中追加音频文件
    */
    appendAudioList(list) {
      if (!Array.isArray(list)) {
        return;
      }
      list.forEach((audio) => {
        this.insertAudio(audio);
      });
    }

    /* 
      清空播放列表
    */
    clearPlaylist() {
      /* 
        停止播放的音乐?
      */
      this.stopAll(); // stop the loadded track before remove list
      // 清空播放列表
      this.playlist = [];
      Howler.unload();
      this.sendPlaylistEvent();
      this.sendLoadEvent();
    }

    /* 
      播放音频文件
    */
    stopAll() {
      this.playlist.forEach((i) => {
        if (i.howl) {
          i.howl.stop();
        }
      });
    }

    /* 
      
    */
    setNewPlaylist(list) {
      if (list.length) {
        // stop current
        this.stopAll();
        Howler.unload();

        this.playlist = list.map((audio) => ({
          ...audio,
          howl: null,
        }));
        // TODO: random mode need random choose first song to load
        this.index = 0;
        this.load(0);
      }
      this.sendPlaylistEvent();
    }

    /* 
      很明显,UI也有一份Data,这里的Data是指播放列表 所以自然知道id是什么
    */
    playById(id) {
      const idx = this.playlist.findIndex((audio) => audio.id === id);
      this.play(idx);
    }

    loadById(id) {
      const idx = this.playlist.findIndex((audio) => audio.id === id);
      this.load(idx);
    }

    /**
     * Play a song in the playlist.
     * @param  {Number} index Index of the song in the playlist
     * (leave empty to play the first or current).
     */
    play(idx) {
      this.load(idx);

      const data = this.playlist[this.index];
      if (!data.howl || !this._media_uri_list[data.id]) {
        this.retrieveMediaUrl(this.index, true);
      } else {
        this.finishLoad(this.index, true);
      }
    }

    /* 

    */
    retrieveMediaUrl(index, playNow) {
      const msg = {
        type: 'BG_PLAYER:RETRIEVE_URL',
        data: {
          /* 
            这里的playlist已经存放了最基本的track基本信息了
          */
          ...this.playlist[index],
          howl: undefined,
          index,
          playNow,
        },
      };

      MediaService.bootstrapTrack(
        msg.data,
        (bootinfo) => {
          /* 
            bootinfo就是目标track的mp3地址
            msg.data实际上是这首track的完全信息,相当于一个完整的API
          */
          msg.type = 'BG_PLAYER:RETRIEVE_URL_SUCCESS';

          msg.data = { ...msg.data, ...bootinfo };

          this.playlist[index].bitrate = bootinfo.bitrate;
          this.playlist[index].platform = bootinfo.platform;

          this.setMediaURI(msg.data.url, msg.data.id);
          this.setAudioDisabled(false, msg.data.index);
          this.finishLoad(msg.data.index, playNow);
          playerSendMessage(this.mode, msg);
        },
        () => {
          msg.type = 'BG_PLAYER:RETRIEVE_URL_FAIL';

          this.setAudioDisabled(true, msg.data.index);
          playerSendMessage(this.mode, msg);

          this.skip('next');
        }
      );
    }

    /**
     * Load a song from the playlist.
     * @param  {Number} index Index of the song in the playlist
     * (leave empty to load the first or current).
     */
    load(idx) {
      let index = typeof idx === 'number' ? idx : this.index;
      if (index < 0) return;
      if (!this.playlist[index]) {
        index = 0;
      }
      // stop when load new track to avoid multiple songs play in same time
      if (index !== this.index) {
        Howler.unload();
      }
      this.index = index;

      this.sendLoadEvent();
    }

    /* 
      播放音频的 Javascript 函数，用于在 HTML5 环境中播放音频。
      它定义了一个名为 finishLoad 的函数，该函数接收两个参数，index 和 playNow。
      它使用 index 参数获取播放列表中的音频，并检查是否已加载，
      如果尚未加载，则可以使用 Howl 来加载音频。
      它还定义了一些播放、暂停、结束等事件的监听器，
      以及使用 MediaSession API 向浏览器发送当前播放的音频的元数据。
      如果无法加载音频，则会发送错误信息。
    */
    finishLoad(index, playNow) {
      /* 
        针对某个track进行对象的设定
      */
      const data = this.playlist[index];
      // If we already loaded this track, use the current one.
      // Otherwise, setup and load a new Howl.
      const self = this;
      /* 
        初始化这个howl
      */
      if (!data.howl) {
        data.howl = new Howl({
          src: [self._media_uri_list[data.url || data.id]],
          volume: 1,
          mute: self.muted,
          html5: true, // Force to HTML5 so that the audio can stream in (best for large files).
          onplay() {
            if ('mediaSession' in navigator) {
              const { mediaSession } = navigator;
              mediaSession.playbackState = 'playing';
              mediaSession.metadata = new MediaMetadata({
                title: self.currentAudio.title,
                artist: self.currentAudio.artist,
                album: `Listen 1  •  ${(
                  self.currentAudio.album || '<???>'
                ).padEnd(100)}`,
                artwork: [
                  {
                    src: self.currentAudio.img_url,
                    sizes: '500x500',
                  },
                ],
              });
            }
            self.currentAudio.disabled = false;
            self.playedFrom = Date.now();
            self.sendPlayingEvent('Playing');
          },
          /* 
            这里应该是每一首歌都是一个huwl对象,这个对象一旦发生改变也要通知UI player改变
          */
          onload() {
            self.currentAudio.disabled = false;
            self.sendPlayingEvent('Loaded');
          },
          onend() {
            switch (self.loop_mode) {
              case 2:
                self.skip('random');
                break;

              case 1:
                self.play();
                break;

              case 0:
              default:
                self.skip('next');
                break;
            }
            self.sendPlayingEvent('Ended');
          },
          onpause() {
            navigator.mediaSession.playbackState = 'paused';
            self.sendPlayingEvent('Paused');
          },
          onstop() {
            self.sendPlayingEvent('Stopped');
          },
          onseek() { },
          onvolume() { },
          onloaderror(id, err) {
            playerSendMessage(this.mode, {
              type: 'BG_PLAYER:PLAY_FAILED',
              data: err,
            });
            self.currentAudio.disabled = true;
            self.sendPlayingEvent('err');
            for (let i = 0; i < self.playlist.length; i += 1) {
              if (self.playlist[i].howl === self.currentHowl) {
                self.playlist[i].howl = null;
              }
            }
            self.currentHowl = null;
            delete self._media_uri_list[data.id];
          },
          onplayerror(id, err) {
            playerSendMessage(this.mode, {
              type: 'BG_PLAYER:PLAY_FAILED',
              data: err,
            });
            self.currentAudio.disabled = true;
            self.sendPlayingEvent('err');
          },
        });
      }

      if (playNow) {
        if (this.playing && index === this.index) {
          return;
        }
        this.playlist.forEach((i) => {
          if (i.howl && i.howl !== this.currentHowl) {
            i.howl.stop();
          }
        });
        this.currentHowl.play();
      }
    }

    /**
     * Pause the currently playing track.
     */
    pause() {
      if (!this.currentHowl) return;

      // Puase the sound.
      this.currentHowl.pause();
    }

    /**
     * Skip to the next or previous track.
     * @param  {String} direction 'next' or 'prev'.
     */
    skip(direction) {
      // 停止当前音频的播放
      Howler.unload();

      // 根据方向获取下一个曲目的索引 播放按钮获取下一首歌曲的Index
      const getNextIndex = (currentIndex) => {
        // 获取当前播放列表的长度
        const playlistLength = this.playlist.length;
        // 获取当前播放模式
        const isRandomMode = this._loop_mode === 2 || direction === 'random';
        //  获取当前播放的索引
        let nextIndex = currentIndex;

        // 随机播放模式
        if (isRandomMode) {
          // 如果随机播放列表为空或者长度不为播放列表的一半
          if (this._random_playlist.length / 2 !== playlistLength) {
            // 构建随机播放列表
            const playlistIndices = Array.from({ length: playlistLength }, (_v, i) => i);
            for (let i = 0; i < playlistLength; i += 1) {
              const remainingIndices = playlistLength - i - 1;
              const randomIndex = Math.floor(Math.random() * remainingIndices);
              const temp = playlistIndices[randomIndex];
              playlistIndices[randomIndex] = playlistIndices[remainingIndices];
              playlistIndices[remainingIndices] = temp;
              // 创建查找表
              playlistIndices[temp + playlistLength] = remainingIndices;
            }
            // 保存随机播放列表
            this._random_playlist = playlistIndices;
          }
          //  获取下一个曲目的索引
          nextIndex = this._random_playlist[currentIndex + playlistLength];
        } else if (this._random_playlist.length !== 0) {
          // 清空随机播放列表
          this._random_playlist = [];
        }

        // 根据方向获取下一个曲目的索引 播放前一首
        if (direction === 'prev') {
          if (nextIndex === 0) {
            nextIndex = playlistLength;
          }
          nextIndex -= 1;
        } else {
          // 播放下一首
          nextIndex += 1;
        }

        // 如果是随机模式则使用随机播放列表的索引，否则使用取模运算计算的索引
        const result = isRandomMode ? this._random_playlist[nextIndex % playlistLength] : nextIndex % playlistLength;

        return result;
      };

      // 获取下一个未禁用的曲目的索引并播放
      let tryCount = 0;
      // 如果当前播放的曲目不是最后一首
      while (tryCount < this.playlist.length) {
        this.index = getNextIndex(this.index);
        if (!this.playlist[this.index].disabled) {
          this.play(this.index);
          return;
        }
        tryCount += 1;
      }

      // 如果所有曲目都禁用，则发送失败事件并停止播放
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:RETRIEVE_URL_FAIL_ALL',
      });
      this.sendLoadEvent();
    }


    /* 
      设置播放模式
    */
    set loop_mode(input) {
      const LOOP_MODE = {
        all: 0,
        one: 1,
        shuffle: 2,
      };
      let myMode = 0;
      if (typeof input === 'string') {
        myMode = LOOP_MODE[input];
      } else {
        myMode = input;
      }
      if (!Object.values(LOOP_MODE).includes(myMode)) {
        return;
      }
      this._loop_mode = myMode;
    }

    get loop_mode() {
      return this._loop_mode;
    }

    /**
     * Set the volume and update the volume slider display.
     * @param  {Number} val Volume between 0 and 1.
     */
    set volume(val) {
      // Update the global volume (affecting all Howls).
      if (typeof val === 'number') {
        /* 
          相当于调节整个播放器的音量
        */
        Howler.volume(val);
        this.sendVolumeEvent();
        this.sendFrameUpdate();
      }
    }

    // eslint-disable-next-line class-methods-use-this
    get volume() {
      return Howler.volume();
    }

    /* 
      调节音量 
      根据参数的大小来调节是增加还是减小
    */
    adjustVolume(inc) {
      this.volume = inc
        ? Math.min(this.volume + 0.1, 1)
        : Math.max(this.volume - 0.1, 0);
      this.sendVolumeEvent();
      this.sendFrameUpdate();
    }

    /* 
      静音
    */
    mute() {
      Howler.mute(true);
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:MUTE',
        data: true,
      });
    }

    /* 
      取消静音
    */
    unmute() {
      Howler.mute(false);
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:MUTE',
        data: false,
      });
    }

    /**
     * Seek to a new position in the currently playing track.
     * @param  {Number} per Percentage through the song to skip.
     */
    seek(per) {
      if (!this.currentHowl) return;

      // Get the Howl we want to manipulate.
      const audio = this.currentHowl;

      // Convert the percent into a seek position.
      // if (audio.playing()) {
      // }
      audio.seek(audio.duration() * per);
    }

    /**
     * Seek to a new position in the currently playing track. 重新定位到准确的播放位置
     * @param {Number} seconds Seconds through the song to skip.
     */
    seekTime(seconds) {
      if (!this.currentHowl) return;
      const audio = this.currentHowl;
      audio.seek(seconds);
    }

    /**
     * Format the time from seconds to M:SS.
     * @param  {Number} secs Seconds to format.
     * @return {String}      Formatted time.
     */
    static formatTime(secs) {
      const minutes = Math.floor(secs / 60) || 0;
      const seconds = secs - minutes * 60 || 0;

      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    /* 
      设置播放列表中的Object的URI
    */
    setMediaURI(uri, url) {
      if (url) {
        this._media_uri_list[url] = uri;
      }
    }

    // idx是什么意思? 为什么要传入idx? 
    setAudioDisabled(disabled, idx) {
      if (this.playlist[idx]) {
        this.playlist[idx].disabled = disabled;
      }
    }

    // 似乎是控制播放状态的函数
    async sendFrameUpdate() {
      // 初始化变量data
      const data = {
        id: this.currentAudio ? this.currentAudio.id : 0,
        duration: this.currentHowl ? this.currentHowl.duration() : 0,
        pos: this.currentHowl ? this.currentHowl.seek() : 0,
        playedFrom: this.playedFrom,
        playing: this.playing,
      };
      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration: this.currentHowl ? this.currentHowl.duration() : 0,
          playbackRate: this.currentHowl ? this.currentHowl.rate() : 1,
          position: this.currentHowl ? this.currentHowl.seek() : 0,
        });
      }
      // 一共有哪些状态? Frame更新是什么意思?
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:FRAME_UPDATE',
        data,
      });
    }

    /* 
      控制当前的播放状态
    */
    async sendPlayingEvent(reason = 'UNKNOWN') {
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:PLAY_STATE',
        data: {
          isPlaying: this.playing,
          reason,
        },
      });
    }

    /* 
      发送加载事件
    */
    async sendLoadEvent() {
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:LOAD',
        data: {
          currentPlaying: {
            ...this.currentAudio,
            howl: undefined,
          },
          playlist: {
            index: this.index,
            length: this.playlist.length
          }
        },
      });
    }

    /* 
      发送音量事件
    */
    async sendVolumeEvent() {
      /* 
        this.mode应该是一个私有状态 
      */
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:VOLUME',
        data: this.volume * 100,
      });
    }

    async sendPlaylistEvent() {
      playerSendMessage(this.mode, {
        type: 'BG_PLAYER:PLAYLIST',
        data: this.playlist.map((audio) => ({ ...audio, howl: undefined })),
      });
    }
  }

  /* 
    这段代码使用 mediaSession API 来设置媒体通知图标的操作处理程序。
    例如，当用户点击播放通知图标时，它会触发 threadPlayer.play()，即播放音频。
    其他操作处理程序也是如此，它们会在用户点击对应的通知图标时触发一些 threadPlayer 函数（例如，点击暂停通知图标时会触发 threadPlayer.pause()）。
  */
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      const { mediaSession } = navigator;
      mediaSession.setActionHandler('play', () => {
        threadPlayer.play();
      });
      mediaSession.setActionHandler('pause', () => {
        threadPlayer.pause();
      });
      mediaSession.setActionHandler('seekforward', (details) => {
        // User clicked "Seek Forward" media notification icon.
        const { currentHowl } = threadPlayer;
        const skipTime = details.seekOffset || threadPlayer.skipTime;
        const newTime = Math.min(
          currentHowl.seek() + skipTime,
          currentHowl.duration()
        );
        threadPlayer.seekTime(newTime);
        threadPlayer.sendFrameUpdate();
      });
      mediaSession.setActionHandler('seekbackward', (details) => {
        // User clicked "Seek Backward" media notification icon.
        const { currentHowl } = threadPlayer;
        const skipTime = details.seekOffset || threadPlayer.skipTime;
        const newTime = Math.max(currentHowl.seek() - skipTime, 0);
        threadPlayer.seekTime(newTime);
        threadPlayer.sendFrameUpdate();
      });
      mediaSession.setActionHandler('seekto', (details) => {
        const { seekTime } = details;
        threadPlayer.seekTime(seekTime);
        threadPlayer.sendFrameUpdate();
      });
      mediaSession.setActionHandler('nexttrack', () => {
        threadPlayer.skip('next');
        threadPlayer.sendFrameUpdate();
      });
      mediaSession.setActionHandler('previoustrack', () => {
        threadPlayer.skip('prev');
        threadPlayer.sendFrameUpdate();
      });
    }
  }

  function initPlayer() {
    // 初始化一个实例的Player
    const threadPlayer = new Player();
    // 设置刷新率
    threadPlayer.setRefreshRate();
    // 真正意义上在全局构造一个Audio播放器控制
    window.threadPlayer = threadPlayer;
    // 发送准备好的消息 告知UI,播放线程已经准备就绪
    playerSendMessage(this.mode, {
      type: 'BG_PLAYER:READY',
    });
    // 设置媒体通知图标的操作处理程序
    setupMediaSession();
  }
}
