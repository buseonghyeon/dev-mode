var app = angular.module('application', []);

app.controller('MypageCtrl', function($scope, appFactory) {
    var urlParams = new URLSearchParams(window.location.search);
    var userId = urlParams.get('userId');

    $scope.currentPage = 0;
    $scope.pageSize = 6;
    $scope.songs = [];
    $scope.totalPages = 0;

    // userId로 사용자 정보 로드
    if (userId) {
        appFactory.queryAB(userId, function(data) {
            console.log('User data:', data);
            $scope.user = data;
            $scope.user.profilePicture = 'https://via.placeholder.com/150';

            // 사용자 음원 정보 로드
            appFactory.getUserSongs(userId, function(songs) {
                $scope.songs = songs.map(song => {
                    song.imageFile = '/uploads/' + song.imageFile.split('/').pop();
                    return song;
                });
                $scope.totalPages = Math.ceil($scope.songs.length / $scope.pageSize);
                $scope.updateCurrentSongs();
            });
        });
    }

    $scope.updateCurrentSongs = function() {
        var start = $scope.currentPage * $scope.pageSize;
        var end = start + $scope.pageSize;
        $scope.currentSongs = $scope.songs.slice(start, end);
    };

    $scope.nextPage = function() {
        if ($scope.currentPage < $scope.totalPages - 1) {
            $scope.currentPage++;
            $scope.updateCurrentSongs();
        }
    };

    $scope.prevPage = function() {
        if ($scope.currentPage > 0) {
            $scope.currentPage--;
            $scope.updateCurrentSongs();
        }
    };

    $scope.goToAddSong = function() {
        window.location.href = './music_register.html?userId=' + $scope.user._id;
    };

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

    $scope.charge = function() {
        var chargeAmount = $scope.chargeAmount;

        if (chargeAmount && chargeAmount > 0) {
            appFactory.chargeAB({ userId: $scope.user._id, amount: chargeAmount }, function(response) {
                if (response.data.success) {
                    appFactory.queryAB($scope.user._id, function(data) {
                        $scope.user = data;
                    });
                    Swal.fire({
                        title: '충전 완료',
                        text: '충전이 완료되었습니다.',
                        icon: 'success',
                    }).then(() => {
                        $('#chargeModal').modal('hide');
                    });
                } else {
                    Swal.fire({
                        title: '충전 실패',
                        text: response.data.message,
                        icon: 'error',
                    });
                }
            });
        } else {
            Swal.fire({
                title: '충전 실패',
                text: '올바른 금액을 입력하세요.',
                icon: 'error',
            });
        }
    };

    $scope.exchange = function() {
        var exchangeAmount = $scope.exchangeAmount;

        if (exchangeAmount && exchangeAmount > 0) {
            appFactory.exchangeAB({ userId: $scope.user._id, amount: exchangeAmount }, function(response) {
                if (response.data.success) {
                    appFactory.queryAB($scope.user._id, function(data) {
                        $scope.user = data;
                    });
                    Swal.fire({
                        title: '환전 완료',
                        text: '환전이 완료되었습니다.',
                        icon: 'success',
                    }).then(() => {
                        $('#exchangeModal').modal('hide');
                    });
                } else {
                    Swal.fire({
                        title: '환전 실패',
                        text: response.data.message,
                        icon: 'error',
                    });
                }
            });
        } else {
            Swal.fire({
                title: '환전 실패',
                text: '올바른 금액을 입력하세요.',
                icon: 'error',
            });
        }
    };

    $scope.editSong = function(songId) {
        window.location.href = `music_edit.html?songId=${songId}&userId=${$scope.user._id}`;
    };

    var form = document.getElementById('registerForm');
    form.addEventListener('submit', function(event) {
     event.preventDefault(); // 폼의 기본 제출 동작을 막음

     var formData = new FormData(form);

     // 폼 데이터를 서버로 전송
     fetch(form.action, {
         method: 'POST',
         body: formData
     }).then(function(response) {
         return response.json();
     }).then(function(data) {
         console.log('등록 성공:', data);
         Swal.fire({
             title: '등록 완료',
             text: '음원이 성공적으로 등록되었습니다.',
             icon: 'success'
         }).then(() => {
             window.location.href = 'mypage.html?userId=' + userId; // 마이페이지로 리디렉션
         });
     }).catch(function(error) {
         console.error('등록 실패:', error);
         Swal.fire({
             title: '등록 실패',
             text: '음원 등록에 실패했습니다.',
             icon: 'error'
         });
     });
 });

 let songToDelete = null;

 $scope.confirmDeleteSong = function(songId) {
     songToDelete = songId;
     $('#deleteConfirmModal').modal('show');
 };

 $scope.deleteSongConfirmed = function() {
    if (songToDelete) {
        appFactory.deleteSong({ songId: songToDelete }, function(response) {
            if (response.status === 200) {
                Swal.fire({
                  title: '삭제 완료',
                  text: '음원이 삭제되었습니다.',
                  icon: 'success',
                }).then(() => {
                    $('#deleteConfirmModal').modal('hide');
                    location.reload(); // 페이지 리로드
                });
            } else {
                alert('삭제 실패: ' + response.data);
            }
        });
    }
};
});

app.factory('appFactory', function($http) {
    var factory = {};

    factory.queryAB = function(name, callback) {
        $http.get('/query?name=' + name).success(function(output) {
            callback(output);
        });
    };

    factory.getUserSongs = function(userId, callback) {
        $http.get('/userSongs?userID=' + userId).success(function(output) {
            callback(output);
        });
    };

    factory.chargeAB = function(data, callback) {
        $http.post('/charge', data).then(function(response) {
            callback(response);
        }).catch(function(error) {
            console.error('Error during charge:', error);
        });
    };

    factory.exchangeAB = function(data, callback) {
        $http.post('/exchange', data).then(function(response) {
            callback(response);
        }).catch(function(error) {
            console.error('Error during exchange:', error);
        });
    };

    factory.deleteSong = function(data, callback) {
        $http.post('/deleteMusic', data).then(function(response) {  // POST 요청으로 변경
            callback(response);
        });
    };


    return factory;
});
