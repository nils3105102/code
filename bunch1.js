var app = angular.module('DispatchApp');

var _momentPickerProvider;

app.requires.push(
    'moment-picker',
    'ngFileUpload'
);

angular
    .module('Dispatch.Controllers')
    .controller('CorrespondenceController', [
        '$http',
        'serverModel',
        'userModel',
        'Searcher',
        'dateParse',
        '$uiModal',
        '$scope',
        '$rootScope',
        '$timeout',
        'toast',
        'Select2Config',
        'BoardTab',
        'userTooltipOptions',
        '$location',
        CorrespondenceController
    ]);

function CorrespondenceController(
    $http,
    sm,
    um,
    dateParse,
    $uiModal,
    $scope,
    $rootScope,
    $timeout,
    toast,
    Select2Config,
    BoardTab,
    userTooltipOptions,
    $location
) {
    var vm = this;
    var chatInterval = null;

    // #region ViewModel

    // #region Data

    vm.dataSources = sm.dataSources;
    vm.activeTab = 'comments';
    vm.disabledTextArea = true;
    vm.tabsContent = {};
    vm.kind = +getKind();
    vm.responsibleUser = '';
    vm.linkedUser = '';
    vm.isLoading = false;
    vm.isAltContentShown = false;
    vm.dateParse = dateParse;
    vm.showMessage = Boolean(sm.correspondence.message);
    vm.selectedCity = [];
    vm.canChangeMessage = true;

    vm.showAltContent = {
        loader: false,
        files: false
    };   
    
    vm.correspondence = sm.correspondence;
    vm.participant = {
        text: vm.correspondence.participant.participantName
    };
    vm.selectedCity[0] = sm.selectedCity;
    vm.BoardTab = BoardTab;

    vm.tabsList = [
        new BoardTab(
            'comments',
            'Комментарии',
            'fas fa-comment',
            'color-mark-shakespeare'
        ),
        new BoardTab(
            'files',
            'Файлы',
            'fas fa-cloud-download',
            'color-mark-ocean-green'
        )

    ];

    // #endregion

    // #region Methods

    vm.changeParticipantName = changeParticipantName;
    vm.changeDataParticipant = changeDataParticipant;
    vm.getHintsData = getHintsData;
    vm.submit = submit;
    vm.openEditCorrespondenceRegistrationDateModal = openEditCorrespondenceRegistrationDateModal;
    vm.openEditResponsibleUserModal = openEditResponsibleUserModal;
    vm.openCorrespondenceCoordinatorsModal = openCorrespondenceCoordinatorsModal;
    vm.openCorrespondenceLinkedUserModal = openCorrespondenceLinkedUserModal;
    vm.deleteCoordinator = deleteCoordinator;
    vm.onFileUpload = onFileUpload;
    vm.openCorrespondenceExecutorsModal = openCorrespondenceExecutorsModal;
    vm.deleteExecutor = deleteExecutor;
    vm.isDisableCoordinatorsFields = isDisableCoordinatorsFields;
    vm.getFiles = getFiles;
    vm.deleteFilesComment = deleteFilesComment;
    vm.showAllComments = showAllComments;
    vm.saveMessage = saveMessage;

    // #endregion

    // #region Configs

    vm.userTooltipOptions = userTooltipOptions;

    vm.commentFormOptions = {
        type: 'correspondence',
        correspondenceId: sm.correspondence.id,
        addUrl: '/api/correspondence/' + sm.correspondence.id + '/comment',
        userImage: um.userImage,
        userName: um.longFullName,
        isDeleteFilePossible: true
    };

    vm.commentListOptions = {
        correspondenceId: sm.correspondence.id,
        deleteUrl: '/api/correspondence/' + sm.correspondence.id + '/comment/',
        deleteFileUrl: '/api/correspondence/files/delete',
        isCanDeleteAnyComment: true,
        isCanDeleteOwnComment: true,
        isDeleteFilePossible: true
    };

    vm.filePreviewListOptions = {
        correspondenceId: sm.correspondence.id,
        isFromComment: vm.activeTab === 'comments',
        isDeletePossible: true,
        deleteUrl: '/api/correspondence/files/delete'
    };

    vm.localitySelect2Options = new Select2Config({
        allowClear: false,
        modelData: ['id', 'text', 'region', 'administrativeArea', 'city'],
        ajax: {
            url: '/api/houses/cities',
            data: function (params) {
                return angular.extend({
                    withDispatchedCompanies: false
                }, params);
            },
            processResults: function (data) {
                return {
                    results: data.results
                };
            }
        }
    });

    // #endregion

    // #region PROXY

    var showAltContentProxyHandler = {
        set: function (obj, prop, value) {
            Reflect.set(obj, prop, value);
            if (prop === 'loader' && value) {
                vm.showAltContent.files = false;
                // vm.showAltContent.history = false;
            }

            vm.isAltContentShown = vm.showAltContent.loader ||
                vm.showAltContent.files && vm.activeTab === 'files'
            // vm.showAltContent.history && vm.activeTab === 'history';
        }
    };

    var showAltContentProxy = new Proxy(vm.showAltContent, showAltContentProxyHandler);

    var tabsContentProxyHandler = {
        set: function (obj, prop, value) {
            if (!value || value.length === 0 || Object.keys(value).length === 0) {
                switch (prop) {
                    case 'files':
                        showAltContentProxy.files = true;
                        break;
                    default:
                        return Reflect.set(obj, prop, value);
                }
            }
            return Reflect.set(obj, prop, value);
        }
    };

    var tabsContentProxy = new Proxy(vm.tabsContent, tabsContentProxyHandler);

    vm.tabsContentProxy = tabsContentProxy;

    // #endregion PROXY

    // #region WATCH

    $scope.$watch(function () {
        return vm.activeTab;
    }, function () {
        getTabData(vm.activeTab);
    });

    // #endregion WATCH

    // #region BindingFunctions

    function changeParticipantName(value) {
        if (!value) return;

        value.text = value.fullName || value.orgName;

        return value;
    }

    function changeDataParticipant() {
        vm.correspondence.participantPostAddress = vm.correspondence.participantName.postAddress;
        vm.correspondence.participantPhone = vm.correspondence.participantName.phoneNumber;
        vm.correspondence.participantEmail = vm.correspondence.participantName.emailAddress;
    }

    function getHintsData() {
        return {
            types: ['Person', 'Organization', 'RegulatoryAuthority'],
            isSearchRelated: true,
            cityGuid: vm.correspondence && vm.correspondence.city && vm.correspondence.city[0].id
        };
    }

    function openEditCorrespondenceRegistrationDateModal() {
        var payload = {
            callback: function (date, time) {
                var payload = {
                    correspondenceId: sm.correspondence.id,
                    registrationDateTime: moment(date).set({
                        hour: time.get('hour'),
                        minute: time.get('minute')
                    })
                    
                };

                vm.correspondence.registrationUtcDateTime = payload.registrationDateTime;

                $http.post('/api/correspondence/registrationDate', payload).then(
                    function() {
                        $uiModal.close('edit-correspondence-date-modal');

                        toast.show({
                            theme: 'success',
                            title: 'Дата регистрации успешно изменена'
                        });
                    },
                    function() {
                        toast.show({
                            theme: 'error',
                            title: 'Ошибка при выполнении операции'
                        });
                    }                    
                )

            },
            registrationUtcDateTime: vm.correspondence.registrationUtcDateTime
        };

        $uiModal.open('edit-correspondence-date-modal', payload);
    }

    function openEditResponsibleUserModal() {
        var payload = {
            callback: function (responsibleUser) {
                var payload = {
                    correspondenceId: sm.correspondence.id,
                    user: responsibleUser.id
                };

                $http.post('/api/correspondence/responsibleUser/change', payload).then(
                    function () {
                        vm.correspondence.responsibleUser = responsibleUser;

                        $uiModal.close('add-responsible-for-correspondence-user-modal');

                        toast.show({
                            theme: 'success',
                            title: 'Ответственный был успешно изменен'
                        });

                        $rootScope.$broadcast('updateResponsibleUser');
                    },
                    function () {
                        toast.show({
                            theme: 'error',
                            title: 'Ошибка при выполнении операции'
                        });
                    }
                );
            },

            responsibleUser: vm.correspondence.responsibleUser
        };

        $uiModal.open('add-responsible-for-correspondence-user-modal', payload);
    }

    function openCorrespondenceCoordinatorsModal() {
        var title = 'Согласовать с';
        var payload = {
            callback: function (coordinators, coordinatorsList) {
                vm.correspondence.coordinators = coordinators.map(
                    function (id) {
                        return coordinatorsList.find(
                            function (coordinators) {
                                return id === coordinators.id;
                            }
                        )
                    });
                var coordinatorsIds = vm.correspondence.coordinators.map(function (coordinator) {
                    return coordinator.id
                });

                var payload = {
                    users: coordinatorsIds,
                    correspondenceId: vm.correspondence.id
                }

                $http.post('/api/correspondence/coordinatorUsers/change', payload).then(                   
                    function () {
                        $uiModal.close('add-coordinators-for-correspondence-user-modal');

                        toast.show({
                            theme: 'success',
                            title: 'Согласователи были успешно изменены'
                        });                        
                    },
                    function () {
                        toast.show({
                            theme: 'error',
                            title: 'Ошибка при выполнении операции'
                        });
                    }
                )

                $timeout(function () {
                    $rootScope.$broadcast('updateCoordinatorUser')
                });
            },
            dataForRequest: {
                availability: ['CorrespondenceCoordinator'],
                companyId: sm.companyId,
                ignorePagination: true
            },
            url: '/api/user/getcolleagues',
            coordinators: vm.correspondence.coordinators || []
        };

        $uiModal
            .option('add-coordinators-for-correspondence-user-modal', 'title', title)
            .open('add-coordinators-for-correspondence-user-modal', payload);
    }

    function openCorrespondenceLinkedUserModal() {
        var model = {
            callback: function (linkedUser) {
                var payload = {
                    correspondenceId: sm.correspondence.id,
                    linkedUserId: linkedUser.id
                };

                $http.post('/api/correspondence/linkedUser/change', payload).then(
                    function () {
                        vm.correspondence.linkedUser = linkedUser;
                        $uiModal.close('add-linked-for-correspondence-user-modal');

                        var linkedUserType = vm.correspondence.kind ? 'Отправитель' : 'Получатель';
                        toast.show({
                            theme: 'success',
                            title: linkedUserType + ' был успешно изменен'
                        });

                        $rootScope.$broadcast('updateLinkedUser');
                    },
                    function () {
                        toast.show({
                            theme: 'error',
                            title: 'Ошибка при выполнении операции'
                        });
                    }
                );
            },

            linkedUser: vm.correspondence.linkedUser
        };

        $uiModal.open('add-linked-for-correspondence-user-modal', model);
    }

    function openCorrespondenceExecutorsModal() {
        var title = 'Исполнители';
        var model = {
            callback: function (executors, executorsList) {
                vm.correspondence.executors = executors.map(
                    function (id) {
                        return executorsList.find(
                            function (executors) {
                                return id === executors.id;
                            }
                        )
                    }
                );

                var executorsIds = vm.correspondence.executors.map(function (executor) {
                    return executor.id
                });

                var payload = {
                    users: executorsIds,
                    correspondenceId: vm.correspondence.id
                }

                $http.post('/api/correspondence/executorUsers/change', payload).then(
                    function () {
                        $uiModal.close('add-executors-for-correspondence-user-modal');

                        toast.show({
                            theme: 'success',
                            title: 'Исполнители были успешно изменены'
                        });

                        
                    },
                    function () {
                        toast.show({
                            theme: 'error',
                            title: 'Ошибка при выполнении операции'
                        });
                    }
                )

                $timeout(function () {
                    $rootScope.$broadcast('updateExecutorUser')
                });
            },

            dataForRequest: {
                availability: ['CorrespondenceExecutor'],
                companyId: sm.companyId,
                ignorePagination: true
            },
            url: '/api/user/getcolleagues',
            executors: vm.correspondence.executors || []
        };

        $uiModal
            .option('add-executors-for-correspondence-user-modal', 'title', title)
            .open('add-executors-for-correspondence-user-modal', model);
    }

    function deleteExecutor(index) {
        var payload = {
            correspondenceId: sm.correspondence.id,
            userId: vm.correspondence.executors[index].id,
            userRole: 1
        }

        $http.post('/api/correspondence/users/delete', payload).then(
            function () {
                vm.correspondence.executors.splice(index, 1);
                updateTooltipsExecutors();
                toast.show({
                    theme: 'success',
                    title: 'Исполнитель успешно удалён'
                });
            },
            function () {
                toast.show({
                    theme: 'error',
                    title: 'Ошибка при выполнении операции'
                });
            }
        );
    }

    function deleteCoordinator(index) {
        var payload = {
            correspondenceId: sm.correspondence.id,
            userId: vm.correspondence.coordinators[index].id,
            userRole: 0
        }

        $http.post('/api/correspondence/users/delete', payload).then(
            function () {
                vm.correspondence.coordinators.splice(index, 1);
                updateTooltipsCoordinators();
                toast.show({
                    theme: 'success',
                    title: 'Согласователь успешно удалён'
                });
            },
            function () {
                toast.show({
                    theme: 'error',
                    title: 'Ошибка при выполнении операции'
                });
            }
        );
    }

    function getTabData(tabId) {
        switch (tabId) {
            case 'comments':
                clearInterval(chatInterval);
                getComments();
                break;
            case 'files':
                clearInterval(chatInterval);
                getFiles();
                break;

            default:
                break;
        }
    }

    function getComments(page) {
        if (!page) page = 1;

        showAltContentProxy.loader = true;

        var payload = {
            page: page,
            take: 10
        };

        var request = $http.post('/api/correspondence/' + sm.correspondence.id + '/comments', payload).then(
            function (response) {
                if (response.data === null) {
                    showAltContentProxy.loader = false;
                    vm.allComments = null;
                    tabsContentProxy.comments = [];
                    return;
                }
                var results = [];
                response.data.results.forEach(function (item) {
                    results.push(item);
                });

                if (response.data.pageInfo) {
                    vm.allComments = response.data.pageInfo.totalItems;
                }

                tabsContentProxy.comments = results;
                showAltContentProxy.loader = false;
            });
        return request;
    }

    function getFiles() {
        showAltContentProxy.loader = true;
        var request = $http.post('/api/correspondence/' + sm.correspondence.id + '/files').then(function (response) {
            tabsContentProxy.files = response.data;
            showAltContentProxy.loader = false;
        });
        return request;
    }

    function onFileUpload(response) {
        var files = response.data;
        addFilesToCorrespondence(files)
            .then(function () {
                files.forEach(function (file) {
                    vm.tabsContentProxy.files.push(file);
                });
            })
            .catch(function () {
                if (!response.data) {
                    toast.show({
                        theme: 'error',
                        title: 'Ошибка!',
                        content: 'Не удалось загрузить файлы.'
                    });
                }
            });
    }

    function submit() {
        vm.form.$submitted = true;

        if (vm.form.$invalid) return;

        return editCorrespondence();
    }

    function deleteFilesComment(comment) {
        if (!comment.files.length && !comment.comment) {
            var index = tabsContentProxy.comments.findIndex(function (item) {
                return item.id === comment.id;
            });

            vm.allComments = vm.allComments - 1;
            tabsContentProxy.comments.splice(index, 1);
        }
    }

    function saveMessage() {
        var payload = {
            correspondenceId: vm.correspondence.id,
            message: vm.correspondence.message
        };

        if (!vm.correspondence.message) {
            vm.showMessage = false;
        }

        $http.post('/api/correspondence/description', payload).then(
            function () {
                toast.show({
                    theme: 'success',
                    title: 'Комментарий успешно сохранён'
                });
            },
            function () {
                toast.show({
                    theme: 'error',
                    title: 'Ошибка при выполнении операции'
                });
            }
        )
    }

    function isDisableCoordinatorsFields() {
        return (
            vm.isLoading ||
            !vm.correspondence.number ||
            !vm.selectedCity ||
            !vm.correspondence.source ||
            !vm.correspondence.participant.participantName ||
            !vm.correspondence.participant.participantPostAddress ||
            (!vm.correspondence.participant.participantPhone && (vm.correspondence.source === 2)) ||
            (!vm.correspondence.participant.participantEmail && (vm.correspondence.source === 1))
        );
    }

    // #endregion BINDING FUNCTIONS

    // #region UTIL FUNCTIONS

    function editCorrespondence() {
        vm.isLoading = true;
        var correspondence = getСorrespondenceData();

        return $http.post('/api/correspondence/save', correspondence).then(
            function (response) {
                vm.isLoading = false;
                toast.show({
                    theme: 'success',
                    title: 'Данные успешно сохранены'
                });
            },
            function () {
                toast.show({
                    theme: 'error',
                    title: 'Ошибка при выполнении операции'
                });
            }
        );
    }

    function addFilesToCorrespondence(files) {
        var request = $http.post('/api/correspondence/uploadFiles', {
            correspondenceId: sm.correspondence.id,
            filesIds: files.map(function (item) {
                return item.id
            })
        });
        return request;
    }

    function getСorrespondenceData() {
        var correspondenceData = {
            correspondenceId: vm.correspondence.id,
            source: vm.correspondence.source,
            customNumber: vm.correspondence.number,
            participant: {
                participantName: vm.participant.text,
                participantPostAddress: vm.correspondence.participant.participantPostAddress,
                participantPhone: vm.correspondence.participant.participantPhone,
                participantEmail: vm.correspondence.participant.participantEmail
            },
            cityGuid: vm.selectedCity[0].id
        };
        return correspondenceData;
    }

    function showAllComments() {
        var payload = {
            page: 1,
            take: vm.allComments
        };
        var request = $http.post('/api/correspondence/' + sm.correspondence.id + '/comments', payload).then(function (response) {
            if (response.data === null) return;

            var results = [];

            response.data.results.forEach(function (item) {
                results.push(item);
            });

            if (response.data.pageInfo) {
                vm.allComments = response.data.pageInfo.totalItems;
            }

            tabsContentProxy.comments = results;
        }).finally(function () {
            showAltContentProxy.loader = false;
        });
        return request;
    }

    function getKind() {
        return $location.search().kind || 0;
    }

    function updateTooltipsExecutors() {
        vm.correspondence.executors.forEach(
            function (executor, index) {
                $timeout(function () {
                    $rootScope.$broadcast('updateExecutor' + index);
                });
            }
        );
    }

    function updateTooltipsCoordinators() {
        vm.correspondence.coordinators.forEach(
            function (coordinator, index) {
                $timeout(function () {
                    $rootScope.$broadcast('updateCoordinator' + index);
                });
            }
        );
    }

    // #endregion UTIL FUNCTION

    // #endregion FUNCTIONS
}