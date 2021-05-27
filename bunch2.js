angular.module('DispatchApp').requires.push('moment-picker');

angular
    .module('Dispatch.Controllers')
    .controller('IndexCorrespondenceController', [
        '$http',
        'serverModel',
        'smartTable',
        'StateFromUrlManager',
        'dateParse',
        'Select2Config',
        'LocalStorage',
        '$location',
        'phoneNumberService',
        'userTooltipOptions',
        'BoardTab',
        IndexCorrespondenceController
    ]);

function IndexCorrespondenceController(
    $http,
    sm,
    smartTable,
    StateFromUrlManager,
    dateParse,
    Select2Config,
    LocalStorage,
    $location,
    phoneNumberService,
    userTooltipOptions,
    BoardTab
) {
    var vm = this;
    var defaultFilter = { kind: vm.INCOMING_KIND };
    vm.INCOMING_KIND = 0;
    vm.OUTGOING_KIND = 1;
    var correspondenceFilter = JSON.parse(LocalStorage.getItem('correspondenceFilter')) || defaultFilter;

    // #region VIEWMODEL

    // #region DATA

    vm.correspondences = [];
    vm.filterForRequest = {};
    vm.isOpenFilter = true;
    vm.correspondenceStages = [];
    vm.sectors = sm.sectors;
    vm.companies = sm.companies;
    vm.filter = {};
    vm.tabsList = [
        new BoardTab(
            'commonSettings',
            'Все',
            null,
            'color-san-marino'
        )
    ];

    vm.selectedTab = vm.tabsList[0];

    // #endregion DATA

    // #region Methods

    vm.getCorrespondence = getCorrespondence;
    vm.getParticipantTooltipOptions = getParticipantTooltipOptions;
    vm.resetFilter = resetFilter;
    vm.smartTable = smartTable;
    vm.getQueryParams = getQueryParams;
    vm.onChangeKind = onChangeKind;
    vm.getTextByKind = getTextByKind;
    vm.isDisabledDownloadLink = isDisabledDownloadLink;
    vm.search = search;
    vm.dateParse = dateParse;

    // #endregion Methods

    // #region Configs

    vm.executorSelect2Options = new Select2Config({
        placeholder: 'Исполнитель',
        ajax: {
            url: '/api/user/getcolleagues',
            useCaching: true,
            data: function (params) {
                return angular.extend({
                    availability: ['CorrespondenceExecutor']
                }, params);
            }
        }
    });

    vm.responsibleUserSelect2Options = new Select2Config({
        placeholder: 'Ответственный',
        ajax: {
            url: '/api/user/getcolleagues',
            useCaching: true,
            data: function (params) {
                return angular.extend({
                    availability: ['CorrespondenceResponsible']
                }, params);
            }
        }
    });
    
    vm.getterUserSelect2Options = new Select2Config({
        placeholder: 'Получатель',
        ajax: getLinkedUserData()
    });

    vm.senderUserSelect2Options = new Select2Config({
        placeholder: 'Отправитель',
        ajax: getLinkedUserData()
    });

    vm.sourceSelect2Options = new Select2Config({
        placeholder: 'Способ',
        ajax: {
            url: '/api/correspondence/dataSources',
            data: function (params) {
                return angular.extend({
                    kind: vm.filter.kind
                }, params);
            }
        }
    });

    vm.userTooltipOptions = userTooltipOptions;

    // #endregion Configs

    // #endregion VIEWMODEL

    // #region INIT

    var stateFromUrlManager = new StateFromUrlManager(getFilter, updateFilter, true);

    setFilterItem();
    stateFromUrlManager.set();
    vm.filterForRequest = getFilter();

    // #endregion INIT

    // #region BindingFunctions

    function getQueryParams() {
        return location.search;
    }

    function getCorrespondence(query) {
        return $http.post('/api/correspondences', query).then(
            function (response) {
                vm.pageInfo = response.data.pageInfo;

                if (vm.pageInfo.pageNumber > vm.pageInfo.totalPages && vm.pageInfo.totalPages > 0) {
                    vm.smartTable.correspondenceTable.searcher.get(vm.pageInfo.totalPages);
                    return response;
                }

                vm.correspondences = response.data.results;
                return response;
            }
        );
    }

    function getParticipantTooltipOptions(participant) {
        return {
            contentAsHTML: true,
            content: '',
            functionFormat: function () {
                var $name = participant.participantName && angular.element('<div/>', {
                    class: 'tooltip-field executor-name',
                    text: participant.participantName
                });

                var $phoneNumber = participant.participantPhone && angular.element('<div/>', {
                    class: 'tooltip-field',
                    text: phoneNumberService.getMaskedPhoneNumber(participant.participantPhone)
                }).prepend('<i class="fas fa-fw fa-phone-office color-on-surface-300"></i>&nbsp;&nbsp;');

                var $email = participant.participantEmail && angular.element('<div/>', {
                    class: 'tooltip-field',
                    text: participant.participantEmail
                });

                return angular.element('<div/>', {
                    class: 'executor-tooltip',
                    append: [$name, $email, $phoneNumber]
                });
            }
        };
    }

    function resetFilter() {
        vm.filter = {kind: vm.INCOMING_KIND};
        search();
    }

    function search() {
        LocalStorage.setItem('correspondenceFilter', JSON.stringify(vm.filter));
        vm.filterForRequest = getFilter();
        stateFromUrlManager.set();
        vm.smartTable.correspondenceTable.searcher.reload();
    }

    function onChangeKind() {
        vm.filter.recipient = {};
        vm.filter.correspondenceSource = null;
        search();
    }

    function getTextByKind(textForIncoming, textForOutgoing) {
        return vm.filter.kind === vm.INCOMING_KIND
            ? textForIncoming
            : textForOutgoing;
    }

    function isDisabledDownloadLink() {
        var query = $location.search();

        return (
            !query.takeCorrespondencesFrom &&
            !query.takeCorrespondencesTo
        );
    }

    // #endregion BindingFunctions

    // #region UTIL FUNCTION

    function getFilter() {
        var f = vm.filter;
        return {
            takeCorrespondencesFrom: f.takeCorrespondencesFrom && dateParse.toIsoDateTime(f.takeCorrespondencesFrom),
            takeCorrespondencesTo: f.takeCorrespondencesTo && dateParse.toIsoDateTime(
                f.takeCorrespondencesTo, '23', '59', '59'
            ),
            participantName: f.participant && f.participant.text,
            correspondenceSource: f.correspondenceSource && f.correspondenceSource[0].id,
            executorId: f.executor && f.executor[0].id,
            responsibleUserId: f.responsibleUser && f.responsibleUser[0].id,
            number: f.number,
            kind: f.kind,
            message: f.message,
            companyId: f.companyId,
            address: f.address,
            linkedUserId: f.linkedUser && f.linkedUser[0].id
        };
    }

    function updateFilter(filterFromUrl) {
        var f = vm.filter;

        if (!angular.isUndefined(filterFromUrl.takeCorrespondencesFrom)) {
            f.takeCorrespondencesFrom = moment(filterFromUrl.takeCorrespondencesFrom);
        }

        if (!angular.isUndefined(filterFromUrl.takeCorrespondencesTo)) {
            f.takeCorrespondencesTo = moment(filterFromUrl.takeCorrespondencesTo);
        }

        if (filterFromUrl.kind) {
            f.kind = +filterFromUrl.kind;
        }

        if (filterFromUrl.participantName) {
            f.participant = {
                id: filterFromUrl.participantName,
                text: filterFromUrl.participantName
            }
        }

        if (filterFromUrl.correspondenceSource) {
            f.correspondenceSource = [{
                id: filterFromUrl.correspondenceSource,
                text: filterFromUrl.recourseSourceText
            }];
        }

        f.number = filterFromUrl.number;

        f.address = filterFromUrl.address;

        f.message = filterFromUrl.message;

        f.linkedUser = [{
            id: filterFromUrl.linkedUserId,
            text: filterFromUrl.linkedUserText
        }];

        f.executor = [{
            id: filterFromUrl.executorId,
            text: filterFromUrl.executorText
        }];

        f.responsibleUser = [{
            id: filterFromUrl.responsibleUserId,
            text: filterFromUrl.responsibleUserText
        }];

        f.companyId = filterFromUrl.companyId;

        vm.filterForRequest = filterFromUrl;
    }

    function setFilterItem() {
        vm.filter = correspondenceFilter || {};

        if (vm.filter.takeCorrespondencesFrom) {
            vm.filter.takeCorrespondencesFrom = moment(vm.filter.takeCorrespondencesFrom);
        }

        if (vm.filter.takeCorrespondencesTo) {
            vm.filter.takeCorrespondencesTo = moment(vm.filter.takeCorrespondencesTo);
        }
    }

    function getLinkedUserData() {
        return {
            url: '/api/user/getDispatchCompanyUsers',
            useCaching: true,
            data: function (params) {
                return angular.extend({
                    availability: ['CorrespondenceLinkedUser']
                }, params);
            }
        }
    }

    // #endregion UTIL FUNCTION

}