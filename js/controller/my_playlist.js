/* eslint-disable no-unused-vars */
/* global angular MediaService */

angular.module('listenone').controller('MyPlayListController', [
  '$scope',
  '$timeout',
  ($scope, $timeout) => {
    /* 
      这段代码可以用来从服务器加载用户的播放列表。它使用了MediaService.showMyPlaylist()来获取数据，并使用$scope.$evalAsync()来异步更新$scope.myplaylists变量，以便在页面上显示用户的播放列表。
    */
    $scope.myplaylists = [];
    $scope.favoriteplaylists = [];

    $scope.loadMyPlaylist = () => {
      MediaService.showMyPlaylist().success((data) => {
        $scope.$evalAsync(() => {
          $scope.myplaylists = data.result;
        });
      });
    };

    $scope.loadFavoritePlaylist = () => {
      MediaService.showFavPlaylist().success((data) => {
        $scope.$evalAsync(() => {
          $scope.favoriteplaylists = data.result;
        });
      });
    };

    /* 
      这段代码用于检测 $scope.current_tag 的变化，如果发现变化，并且新的值为“1”，则会执行 $scope.loadMyPlaylist() 函数。 
      $scope.myplaylists 将被清空，并且新的播放列表数据将依据该函数从服务器获取。
    */
    $scope.$watch('current_tag', (newValue, oldValue) => {
      if (newValue !== oldValue) {
        if (newValue === '1') {
          $scope.myplaylists = [];
          $scope.loadMyPlaylist();
        }
      }
    });

    /* 
      AngularJS控制器中监听名为'myplaylist:update'的事件
      一旦该事件被触发，就会调用$scope.loadMyPlaylist()方法来载入播放列表。
    */
    $scope.$on('myplaylist:update', (event, data) => {
      $scope.loadMyPlaylist();
    });

    /* 
      当发生favoriteplaylist:update事件时，$scope.loadFavoritePlaylist()函数将会被调用，data参数将会接收事件传递过来的数据。
    */
    $scope.$on('favoriteplaylist:update', (event, data) => {
      $scope.loadFavoritePlaylist();
    });
  },
]);
