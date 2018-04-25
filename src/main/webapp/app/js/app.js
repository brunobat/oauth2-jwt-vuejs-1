/**
 *
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

(function () {
    'use strict';

    var deps = [
        'app/js/view/container',
        'app/js/view/login',
        'app/js/view/main',
        'app/js/view/main-table-paginator',
        'app/js/view/movie',
        'lib/underscore',
        'app/js/model/movies',
        'app/js/model/movie',
        'app/js/model/auth',
        'app/js/i18n',
        'lib/less', 'lib/backbone', 'lib/jquery', 'lib/bootstrap'
    ];
    define(deps, function (containerView, loginView, mainView, paginator, MovieView, underscore, moviesList, MovieModel, AuthModel, i18n) {
        var auth = new AuthModel();
        window.auth = auth;
        var max = 5;
        var appState = {
            page: null,
            fieldName: null,
            fieldValue: null
        };
        containerView.render();
        var router = null;

        $.ajaxSetup({ cache: false });

        function loadPage(pageNumber, fieldName, fieldValue) {

            auth.getAuth().then(
                function () {
                    pageLoading(pageNumber, fieldName, fieldValue);
                }
            ).catch( function () {
                    router.navigate('login', {
                        trigger: true
                    });
                }
            )
        }

        function pageLoading(pageNumber, fieldName, fieldValue) {

            var data = {
                max: max,
                first: ((pageNumber - 1) * max)
            };
            if (fieldName && fieldValue) {
                data.field = fieldName;
                data.searchTerm = fieldValue;
            }
            mainView.setFilter(fieldName, fieldValue);
            moviesList.fetch({
                data: data,
                success: function (result) {
                    mainView.addRows(result.models);

                    $.ajax({
                        url: window.ux.ROOT_URL + 'rest/movies/count/',
                        method: 'GET',
                        dataType: 'json',
                        data: {
                            field: appState.fieldName,
                            searchTerm: appState.fieldValue
                        },
                        success: function (total) {
                            var count = Math.ceil(total / max);
                            paginator.setCount(count);
                            mainView.setPaginator(count);
                        }
                    });
                }
            });
        }

        function start() {
            //Starting the backbone router.
            var Router = Backbone.Router.extend({
                routes: {
                    '': 'showMain',
                    'main': 'showMain',
                    'main/:page': 'showMain',
                    'main/:page/:field/:value': 'showMain',
                    'login': 'showLogin'
                },
                showLogin: function () {
                    containerView.showView(loginView);
                },
                showMain: function (page, fieldName, fieldValue) {
                    var me = this;
                    appState.page = page;
                    appState.fieldName =  fieldName;
                    appState.fieldValue = fieldValue;
                    containerView.showView(mainView);
                    if (!page || !underscore.isNumber(Number(page))) {
                        me.showMain(1);
                    } else {
                        loadPage(Number(page), fieldName, fieldValue);
                        paginator.setPage(Number(page));
                        if (fieldName) {
                            me.navigate('main/' + page + '/' + fieldName + '/' + fieldValue, {
                                trigger: false
                            });
                        } else {
                            me.navigate('main/' + page, {
                                trigger: false
                            });
                        }
                    }
                }
            });

            router = new Router();

            mainView.on('load-sample', function () {
                $.ajax({
                    url: window.ux.ROOT_URL + 'rest/load/',
                    method: 'POST',
                    dataType: 'json',
                    data: {},
                    success: function (data) {
                        router.showMain();
                    }
                });
            });

            mainView.on('delete', function (data) {
                data.model.destroy({
                    success: function () {
                        router.showMain(appState.page, appState.fieldName, appState.fieldValue);
                    }
                });
            });

            function showMovieWindow(model) {
                var view = new MovieView({
                    model: model
                });
                view.render();
                view.on('save-model', function (data) {
                    data.model.save({}, {
                        success: function () {
                            view.remove();
                            loadPage(appState.page, appState.fieldName, appState.fieldValue);
                        }
                    });
                });
                $('body').append(view.$el);
                view.$el.modal({});
            }

            mainView.on('add', function () {
                showMovieWindow(new MovieModel({}));
            });

            mainView.on('edit', function (data) {
                showMovieWindow(data.model);
            });

            mainView.on('filter', function (data) {
                router.navigate('main/1/' + data.filterType + '/' + data.filterValue, {
                    trigger: true
                });
            });

            mainView.on('clear-filter', function (data) {
                router.navigate('main/1', {
                    trigger: true
                });
            });

            paginator.on('go-to-page', function (data) {
                var page = data.number;
                if (page === 'last') {
                    page = paginator.getCount();
                }
                router.showMain(page, appState.fieldName, appState.fieldValue);
            });

            //Starting the backbone history.
            Backbone.history.start({
                pushState: true,
                root: window.ux.ROOT_URL // This value is set by <c:url>
            });

            return {
                getRouter: function () {
                    return router;
                }
            };
        }

        return {
            start: start,
            auth: auth
        };
    });
}());