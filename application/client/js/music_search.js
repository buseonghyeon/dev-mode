var app = angular.module('searchApp', []);

// AngularJS 컨트롤러 정의
app.controller('SearchCtrl', function($scope, $http) {
    var urlParams = new URLSearchParams(window.location.search);
    var userId = urlParams.get('userId');

    // $scope.user 객체 초기화
    $scope.user = {
        _id: userId
    };

    // 홈 버튼 클릭 시 mainpage로 리디렉션
    $scope.goToMypage = function() {
        window.location.href = 'mypage.html?userId=' + $scope.user._id;
    };

    $scope.goToTransfer = function() {
        window.location.href = 'transfer.html?userId=' + $scope.user._id;
    };

    $scope.goToMusic_search = function() {
        window.location.href = 'music_search.html?userId=' + $scope.user._id;
    };

    $scope.goToMainpage = function() {
        window.location.href = 'mainpage.html?userId=' + $scope.user._id;
    };

    $scope.goToRegisterMusic = function() {
        window.location.href = 'music_register.html?userId=' + $scope.user._id;
    };

    $scope.fetchUserSongs = function() {
        var userID = document.getElementById('userID').value;
        $http.get(`/userSongs?userID=${userID}`)
            .then(function(response) {
                var songs = response.data;
                var resultDiv = document.getElementById('result');
                resultDiv.innerHTML = '';

                if (songs.length === 0) {
                    resultDiv.innerHTML = '<p>해당 회원의 음원이 없습니다.</p>';
                    return;
                }

                songs.forEach(function(song) {
                    var songDiv = document.createElement('div');
                    songDiv.className = 'song';
                    songDiv.innerHTML = `<p>음원명: ${song.songName}</p><p>장르: ${song.genre}</p><p>가격: ${song.price}</p>`;
                    resultDiv.appendChild(songDiv);
                });
            })
            .catch(function(error) {
                console.error('Error fetching user songs:', error);
            });
    };
});
