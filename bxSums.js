// ==UserScript==
// @name         Bitrix-Sums
// @version      2.31
// @description  Summiert Stunden und Story Points in Bitrix-Boards und Sprints (mit Rest-Tags Unterstützung)
// @author       Michael E.
// @updateURL    https://eime.github.io/bxSums/bxSums.meta.js
// @downloadURL  https://eime.github.io/bxSums/bxSums.js
// @include      https://bitrix.*.de/*
// @grant        none
// @require https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require https://underscorejs.org/underscore-min.js
// ==/UserScript==

var
    loadingPagesCount = {},
    maxLoadingSecondsPerColumn = 4;

(function() {
    'use strict';
    window._$ = window.$.noConflict(true);

    if (window.localStorage.getItem("calcMode") === null) {
        window.localStorage.setItem("calcMode", '1');
    }

    if (window.localStorage.getItem("showPics") === null) {
        window.localStorage.setItem("showPics", '1');
    }
    if (window.localStorage.getItem("showMode") === null) {
        window.localStorage.setItem("showMode", '1');
    }

    if (_$(".main-kanban-column").length || _$("#bizproc_task_list_table").length || _$(".tasks-iframe-header").length) {
        _$("head").append(
            '<link id="bxSumsLink" href="https://eime.github.io/bxSums/bxSumsCards.css?31" rel="stylesheet" type="text/css">'
        );
    }

    handleTags();

    // Beim Klick auf den Titel einer Liste werden alle Karten darin in neuen Tabs geoeffnet
    _$(".main-kanban-column-title-info").attr("title", "\u24d8 Doppelklick um alle Karten in neuen Tabs zu öffnen.").dblclick(function (event) {
        var
            urls = [];

        _$(this).parents(".main-kanban-column").find(".tasks-kanban-item-title").each(function () {
            urls.push(window.location.origin + _$(this).attr("href"));
        });

        if (!urls.length) {
            return alert("Die Spalte enthaelt keine Karten...");
        }

        if (event.shiftKey) {
            copyToClipboard(urls.join("\n"));
        } else {
            for (var i = 0; i < urls.length; i++) {
                window.open(urls[i], "_blank");
            }
        }
    });


    setMenuItems();
    useSettings();
    handleTaskLinkCopy();
})();

// Erlaubt es bei Klick auf das Task-Link-Symbol mit Shift, dass der Link im Markdown-Format im Clipboard landet
function handleTaskLinkCopy() {
    _$(".js-id-copy-page-url").bind("click", (ev) => { if (ev.shiftKey) {

        copyToClipboard("[" + document.title.replace(/\[.*?\]/g, "").trim() + "](" + BX.util.remove_url_param(window.location.href, ["IFRAME", "IFRAME_TYPE"]) + ")", true);
        ev.preventDefault(); ev.stopPropagation();
        var node = ev.target;
        var popupParams = {
            content: BX.message('TASKS_TIP_TEMPLATE_LINK_COPIED') + " (Markdown-Format)",
            darkMode: true,
            autoHide: true,
            zIndex: 1000,
            angle: true,
            offsetLeft: 20,
            bindOptions: {
                position: 'top'
            }
        };
        var popup = new BX.PopupWindow(
            'my_tasks_clipboard_copy',
            node,
            popupParams
        );
        popup.show();

        setTimeout(function(){
            popup.close();
        }, 1500);
    }});
}

function handleTags() {
    processTags(".main-kanban-column .tasks-kanban-item-title");
    processTags(".task-popup-pagetitle-item");
    processTags("#bizproc_task_list_table a", true);
    processTags(".tasks-scrum__item--title");
}

function processTags(selector, parentSelector) {
    _$(selector).each(function () {
        const $el = _$(this);
        const tags = extractValuesInBrackets($el.text());

        if (!tags.length || $el.find(".bsTags").length) {
            return;
        }

        const $tags = _$("<div>").addClass("bsTags");

        tags.forEach(tag => {
            $tags.append(_$("<span>").addClass(tag.toLowerCase()).text(tag));
            $el.html($el.html().replace("[" + tag + "]", ""));
        });

        if (parentSelector) {
            $tags.prependTo($el.parent());
        } else {
            $tags.prependTo($el);
        }
    });
}

function extractValuesInBrackets(text) {
  const regex = /\[([^\]]+)\]/g;
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
    if (!/\[/.test(text.slice(match.index + match[0].length))) {
      break;
    }
  }

  return matches;
}

function setMenuItems() {
    const
        $menu = _$("#popup-window-content-popupMenuOptions .menu-popup-items");

    $menu.append(
        '<span class="menu-popup-item menu-popup-no-icon"><span class="menu-popup-item-icon"></span><span class="menu-popup-item-text"><b>Mobi-Features:</b></span></span>'
    );

    _$('<span class="menu-popup-item menu-popup-item-none mobi-feature mobi-feature-compact"><span class="menu-popup-item-icon"></span><span class="menu-popup-item-text">Kompakte Ansicht</span></span>')
    .attr("title", "ⓘ Blendet unwichtige Informationen bei den Karten aus und verringert die Abstände.")
    .bind("click", () => {
        _$(".mobi-feature-compact").toggleClass("active");
        window.localStorage.setItem("denseMode", _$(".mobi-feature-compact").hasClass("active") ? 1 : 0);
        updateDenseMode();
    }).toggleClass("active", useDenseMode())
    .appendTo($menu);

    _$('<span class="menu-popup-item menu-popup-item-none mobi-feature mobi-feature-nopic"><span class="menu-popup-item-icon"></span><span class="menu-popup-item-text">Bilder anzeigen</span></span>')
    .attr("title", "ⓘ Bilder bei den Karten anzeigen?")
    .bind("click", () => {
        _$(".mobi-feature-nopic").toggleClass("active");
        window.localStorage.setItem("showPics", _$(".mobi-feature-nopic").hasClass("active") ? 1 : 0);
        updateShowPics();
    }).toggleClass("active", showPics())
    .appendTo($menu);

    _$('<span class="menu-popup-item menu-popup-item-none mobi-feature mobi-feature-hide"><span class="menu-popup-item-icon"></span><span class="menu-popup-item-text">Ausgeblendete Spalten anzeigen</span></span>')
    .attr("title", "ⓘ Spalten können durch ein [hide] im Titel ausgeblendet werden.")
    .bind("click", () => {
        _$(".mobi-feature-hide").toggleClass("active");
        window.localStorage.setItem("showMode", _$(".mobi-feature-hide").hasClass("active") ? 1 : 0);
        prepareColumns();
    }).toggleClass("active", showMode())
    .appendTo($menu);

    _$('<span class="menu-popup-item menu-popup-item-none mobi-feature mobi-feature-calc"><span class="menu-popup-item-icon"></span><span class="menu-popup-item-text">Stundensummierung (Story Points)</span></span>')
    .attr("title", "ⓘ Summierung der Story Points bei den einzelnen Spalten. Tipp: [nocalc] im Titel deaktiviert die Berechnung für einzelne Spalten.")
    .bind("click", () => {
        _$(".mobi-feature-calc").toggleClass("active");
        window.localStorage.setItem("calcMode", _$(".mobi-feature-calc").hasClass("active") ? 1 : 0);
        updateCalcMode();
    }).toggleClass("active", useCalc())
    .appendTo($menu);
}

function updateShowPics() {
    _$(".main-kanban").toggleClass("noPicMode", !showPics());
}

function showPics() {
    return window.localStorage.getItem("showPics") === "1";
}

function useCalc() {
    return window.localStorage.getItem("calcMode") === "1";
}

function useDenseMode() {
    return window.localStorage.getItem("denseMode") === "1";
}

function showMode() {
    return window.localStorage.getItem("showMode") === "1";
}

function updateCalcMode() {
    if (useCalc()) {
        bxSumsInit();
        prepareSprints();
    } else {
        _$(".main-kanban-column-body").removeClass("calculated");
        _$(".tasks-scrum__content-container").removeClass("sprint-calculated");
        _$(".customBxSums").detach();
    }
}

function updateDenseMode() {
    _$(".main-kanban").toggleClass("denseMode", useDenseMode());
}

function useSettings() {
    prepareColumns();
    updateDenseMode();
    updateCalcMode();
    updateShowPics();
    prepareSprints(); // Sprint-Ansicht vorbereiten
}

function prepareColumns() {
    handleTags();
    _$(".main-kanban-column-title-text-inner").each((idx, title) => {
        const $col = _$(title).parents(".main-kanban-column");

        if (_$(title).text().trim() === "[spacer]") {
            $col.addClass("kanban-spacer");
        } else {
            $col.removeClass("kanban-spacer");
        }

        if (_$(title).text().trim().indexOf("[hide]") >=0 && !showMode()) {
            $col.addClass("hide");
        } else {
            $col.removeClass("hide");
        }

        $col.find(".main-kanban-column-title-input-edit").not(".changeHandled").change(() => {
            $col.find(".main-kanban-column-body").removeClass("calculated");
            window.setTimeout(prepareColumns, 200);
            window.setTimeout(calculateVisibles, 200);
        }).addClass("changeHandled");
    });
    calculateVisibles();
}

function copyToClipboard(str, hideAlert) {
    var $cpTextarea = _$("<textarea>")
        .attr("id", "copyTmpTextarea")
        .css({
            position: 'absolute',
            left: '-99999px'
        })
        .appendTo(document.body);
    $cpTextarea.val(str).get(0).select();
    document.execCommand("copy");
    if (!hideAlert) {
        alert("Folgender Text wurde in die Zwischenablage kopiert: \n" + str);
    }
    $cpTextarea.detach();
}

function bxSumsInit() {
    if (!cssLoaded()) {
        window.setTimeout(bxSumsInit, 200);
    } else {
        onCssLoaded();
    }
}

function onCssLoaded() {
    var
        $container = _$(".main-kanban-grid");

    calculateVisibles();

    $container.unbind("scroll");
    $container.bind("scroll", _.debounce(calculateVisibles, 50));

    // Beobachte Sprint-Änderungen
    if (_$(".tasks-scrum__sprints").length) {
        var lastTaskCount = {};

        var sprintObserver = new MutationObserver(_.debounce(function() {
            // Prüfe ob sich die Anzahl der Tasks geändert hat
            var changed = false;
            _$(".tasks-scrum__content").each(function() {
                var $sprint = _$(this);
                var sprintId = $sprint.attr("data-sprint-id");
                if (sprintId) {
                    var currentCount = $sprint.find(".tasks-scrum__item").length;
                    if (!lastTaskCount[sprintId] || lastTaskCount[sprintId] !== currentCount) {
                        lastTaskCount[sprintId] = currentCount;
                        changed = true;
                    }
                }
            });

            prepareSprints();
        }, 500));

        _$(".tasks-scrum__sprints").each(function() {
            sprintObserver.observe(this, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        });

        // Initiale Berechnung nach kurzer Verzögerung
        setTimeout(function() {
            prepareSprints();
        }, 1000);
    }

    // Beobachte Backlog-Änderungen
    if (_$(".tasks-scrum__backlog").length) {
        var backlogObserver = new MutationObserver(_.debounce(function() {
            prepareSprints();
        }, 200));

        _$(".tasks-scrum__backlog").each(function() {
            backlogObserver.observe(this, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        });
    }
}

function calculateVisibles() {
    if (!useCalc()) {
        return;
    }

    var
        $container = _$(".main-kanban-grid");

    _$(".main-kanban-column-body").not(".calculated").each(function () {
        var
            $this = _$(this),
            $parent = $this.parent(),
            left = $parent.position().left,
            title = $parent.find(".main-kanban-column-title-text-inner").text() || "";

        if (title.indexOf("[nocalc]") >= 0 || (title.indexOf("[hide]") >= 0 && !showMode())) {
            $this.removeClass("calculated")
            $parent.find(".customBxSums").detach();
        } else {
            // Im Sichtbereich?
            if (!$this.hasClass("calculated") && left > ($this.width() * -1) && left < $container.width()) {
                var stageId = $this.attr("data-id");
                calculateFromDOM($this, stageId, true);
                $this.addClass("calculated");

                // Versuche auch mit Kanban-Objekt, falls vorhanden
                if (typeof Kanban !== 'undefined' && Kanban.columns && Kanban.columns[stageId]) {
                    loadAllItems($this, Kanban.columns[stageId]);
                }
            }
        }
    });
}

function calculateFromDOM($list, stageId, addEventHandler) {
    var
        $parent = $list.parent(),
        $bxSums = $parent.find(".customBxSums"),
        $title = $parent.find(".main-kanban-column-title-text-inner"),
        titleBg = $parent.find(".main-kanban-column-title-bg").css("background-color"),
        titleColor = $title.css("color");

    // Fallback für Sprint-Planning-Spalten ohne eigenen Header
    if (!titleBg || titleBg === "rgba(0, 0, 0, 0)" || titleBg === "transparent" || !$title.length) {
        // Suche die entsprechende Spalte im vorherigen main-kanban Container über den Index
        var $mainKanban = $parent.closest(".main-kanban");
        var $prevKanban = $mainKanban.prev(".main-kanban");

        if ($prevKanban.length) {
            // Finde den Index der aktuellen Spalte im unteren Grid
            var $allColumnsInCurrentGrid = $mainKanban.find(".main-kanban-column");
            var columnIndex = $allColumnsInCurrentGrid.index($parent);

            // Hole die entsprechende Spalte im oberen Grid (gleicher Index)
            var $correspondingColumn = $prevKanban.find(".main-kanban-column").eq(columnIndex);

            if ($correspondingColumn.length) {
                titleBg = $correspondingColumn.find(".main-kanban-column-title-bg").css("background-color");
                titleColor = $correspondingColumn.find(".main-kanban-column-title-text-inner").css("color");
            }
        }

        // Wenn immer noch keine Farbe gefunden wurde, verwende Standardwerte
        if (!titleBg || titleBg === "rgba(0, 0, 0, 0)" || titleBg === "transparent") {
            titleBg = "#949da9";
        }
        if (!titleColor || titleColor === "rgba(0, 0, 0, 0)") {
            titleColor = "#000";
        }
    }

    var
        column = (typeof Kanban !== 'undefined' && Kanban.columns && Kanban.columns[stageId]) ? Kanban.columns[stageId] : null,
        tasks = column ? column.items : [],
        $items = $list.find(".main-kanban-item"),
        estimations = {},
        spent = {},
        rest = {},
        responsibles = {},
        totalRest = 0,
        totalSpent = 0,
        totalEstimated = 0;

    if ($title.text().indexOf("[nocalc]") >= 0) {
        return;
    }

    if (addEventHandler && column) {
        BX.addCustomEvent(column.grid, "Kanban.Column:render", function () {
            calculateFromDOM($list, stageId);
            _.delay(prepareColumns, 200);
        });
    }

    handleTags();

    // Wenn Kanban-Objekt verfügbar ist, verwende es (bevorzugt)
    if (tasks && tasks.length) {
        for (var i = 0; i < tasks.length; i++) {
            var
                task = tasks[i],
                data = task.data,
                responsibleId = data.responsible && data.responsible.id || "",
                responsibleData = data.responsible,
                tags = data.tags,
                curSpent = parseInt(data.time_logs || 0),
                estimated = parseInt(data.time_estimate || 0),
                curRest = estimated,
                points = 0,
                pointsRest = 0,
                useStoryPoints = false;

            // Prüfe ob Story Points verwendet werden sollen
            var $item = _$($items[i]);
            var $storyPointsEl = $item.find(".tasks-kanban-item-story-points");
            if ($storyPointsEl.length && $storyPointsEl.text().trim()) {
                points = parseFloat($storyPointsEl.text().trim()) || 0;
                pointsRest = points; // Default: Rest = Story Points
                useStoryPoints = (points > 0);
            }

            // Wenn Story Points vorhanden sind, verwende diese
            // Andernfalls verwende die Original-Zeiterfassung
            if (!useStoryPoints && estimated > 0) {
                // Original-Logik für Zeiterfassung
                curRest = estimated;

                // Rest aus Tags ermitteln
                if (tags && tags.length) {
                    _.each(tags, function (tag) {
                        var match = tag.match(/^Rest.*?([\d.,]+)\s*?$/);
                        if (match && match.length > 1) {
                            curRest = timeStrToSeconds(match[1]);
                        }
                    });
                }

                responsibles[responsibleId] = responsibleData;

                if (!spent[responsibleId]) {
                    spent[responsibleId] = 0;
                }

                if (!estimations[responsibleId]) {
                    estimations[responsibleId] = 0;
                }

                if (!rest[responsibleId]) {
                    rest[responsibleId] = 0;
                }

                spent[responsibleId] += curSpent;
                estimations[responsibleId] += estimated;
                rest[responsibleId] += curRest;

                totalSpent += curSpent;
                totalRest += curRest;
                totalEstimated += estimated;
            } else if (useStoryPoints) {
                // Neue Logik für Story Points
                // Rest aus Tags ermitteln (aus JavaScript-Objekt)
                if (tags && tags.length) {
                    _.each(tags, function (tag) {
                        var cleanTag = tag.replace(/^#/, '');
                        var match = cleanTag.match(/^Rest\s*:?\s*([\d.,]+)\s*?$/i);
                        if (match && match.length > 1) {
                            pointsRest = parseFloat(match[1].replace(',', '.')) || 0;
                        }
                    });
                }

                // Falls keine Tags im JS-Objekt, versuche aus DOM zu lesen
                if ((!tags || !tags.length) && points > 0) {
                    var $tagsEl = $item.find(".tasks-kanban-item-tags .ui-label-inner");
                    if ($tagsEl.length) {
                        $tagsEl.each(function() {
                            var tagText = _$(this).text().trim();
                            var cleanTag = tagText.replace(/^#/, '');
                            var match = cleanTag.match(/^Rest\s*:?\s*([\d.,]+)\s*?$/i);
                            if (match && match.length > 1) {
                                pointsRest = parseFloat(match[1].replace(',', '.')) || 0;
                            }
                        });
                    }
                }

                responsibles[responsibleId] = responsibleData;

                if (!spent[responsibleId]) {
                    spent[responsibleId] = 0;
                }

                if (!estimations[responsibleId]) {
                    estimations[responsibleId] = 0;
                }

                if (!rest[responsibleId]) {
                    rest[responsibleId] = 0;
                }

                // Bei Story Points: Spent = Estimated - Rest
                var pointsSpent = points - pointsRest;

                spent[responsibleId] += pointsSpent;
                estimations[responsibleId] += points;
                rest[responsibleId] += pointsRest;

                totalSpent += pointsSpent;
                totalEstimated += points;
                totalRest += pointsRest;
            }
        }
    } else {
        // Fallback: Nur aus DOM lesen (wenn Kanban-Objekt nicht verfügbar)
        if (!$items.length) {
            $bxSums.detach();
            return;
        }

        $items.each(function() {
            var
                $item = _$(this),
                $kanbanItem = $item.find(".tasks-kanban-item"),
                $storyPointsEl = $kanbanItem.find(".tasks-kanban-item-story-points"),
                $responsibleEl = $kanbanItem.find(".tasks-kanban-item-responsible-sprint .tasks-kanban-item-author-avatar, .tasks-kanban-item-responsible .tasks-kanban-item-author-avatar"),
                $titleEl = $kanbanItem.find(".tasks-kanban-item-title"),
                $tagsEl = $kanbanItem.find(".tasks-kanban-item-tags .ui-label-inner"),
                responsibleName = $responsibleEl.attr("title") || "Unbekannt",
                responsibleImg = $responsibleEl.css("background-image"),
                points = 0,
                pointsRest = 0;

            // Lese Story Points
            if ($storyPointsEl.length) {
                var pointsText = $storyPointsEl.text().trim();
                points = parseFloat(pointsText) || 0;
                pointsRest = points; // Default: Rest = Story Points
            }

            // Suche nach Rest-Tags im Titel und in Tags
            var titleText = $titleEl.text();
            var allTags = extractValuesInBrackets(titleText);

            // Lese auch Tags aus DOM
            if ($tagsEl.length) {
                $tagsEl.each(function() {
                    var tagText = _$(this).text().trim();
                    allTags.push(tagText);
                });
            }

            if (allTags && allTags.length) {
                _.each(allTags, function (tag) {
                    // Entferne # am Anfang falls vorhanden
                    var cleanTag = tag.replace(/^#/, '');
                    var match = cleanTag.match(/^Rest\s*:?\s*([\d.,]+)\s*?$/i);
                    if (match && match.length > 1) {
                        pointsRest = parseFloat(match[1].replace(',', '.')) || 0;
                    }
                });
            }

            if (points > 0) {
                if (!spent[responsibleName]) {
                    spent[responsibleName] = 0;
                }

                if (!estimations[responsibleName]) {
                    estimations[responsibleName] = 0;
                }

                if (!rest[responsibleName]) {
                    rest[responsibleName] = 0;
                }

                responsibles[responsibleName] = {
                    name: responsibleName,
                    photo: responsibleImg
                };

                // Bei Story Points: Spent = Estimated - Rest
                var pointsSpent = points - pointsRest;

                spent[responsibleName] += pointsSpent;
                estimations[responsibleName] += points;
                rest[responsibleName] += pointsRest;

                totalSpent += pointsSpent;
                totalEstimated += points;
                totalRest += pointsRest;
            }
        });
    }

    // Erstelle oder aktualisiere die Anzeige
    if (totalEstimated > 0) {
        if (!$bxSums.length) {
            $bxSums = _$("<ul>")
                .addClass("customBxSums");
            $list.before($bxSums);
        }
        $bxSums.empty().hide();

        // Zeige Stunden/Story Points pro Verantwortlichem
        for (var id in responsibles) {
            var
                r = responsibles[id] || {},
                name = r.name || id,
                icon = r.photo && r.photo.src ? "url('" + r.photo.src + "')" : r.photo;

            if (estimations[id] > 0) {
                _$("<li>")
                    .addClass("uSum")
                    .data("name", name)
                    .css("display", "flex")
                    .append(
                        _$("<div>")
                            .attr("title", name)
                            .addClass("tasks-kanban-item-author-avatar")
                            .css("background-image", icon || "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2040%2040%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23525C68%22/%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M30.4364902%2C31.4100231%20C30.4364902%2C29.9871769%2028.8398242%2C23.9680557%2028.8398242%2C23.9680557%20C28.8398242%2C23.0883414%2027.6898708%2C22.083459%2025.4253473%2C21.4978674%20C24.6581347%2C21.2838747%2023.9288072%2C20.9520366%2023.2634349%2C20.514215%20C23.1179216%2C20.4310645%2023.1400361%2C19.6628072%2023.1400361%2C19.6628072%20L22.4107003%2C19.5517925%20C22.4107003%2C19.4894296%2022.3483374%2C18.5681401%2022.3483374%2C18.5681401%20C23.2209751%2C18.274902%2023.1311903%2C16.5451067%2023.1311903%2C16.5451067%20C23.6853794%2C16.8524981%2024.0462878%2C15.4836113%2024.0462878%2C15.4836113%20C24.7017612%2C13.5817654%2023.719878%2C13.6967607%2023.719878%2C13.6967607%20C23.8916546%2C12.5357299%2023.8916546%2C11.3557413%2023.719878%2C10.1947105%20C23.283338%2C6.34325128%2016.7109122%2C7.38882426%2017.4902268%2C8.64669632%20C15.5693624%2C8.29286451%2016.0076715%2C12.6635719%2016.0076715%2C12.6635719%20L16.4243085%2C13.7953913%20C15.6060724%2C14.326139%2016.1748571%2C14.9679015%2016.2031636%2C15.7065254%20C16.243412%2C16.7972119%2016.9108272%2C16.5712018%2016.9108272%2C16.5712018%20C16.9519602%2C18.3713211%2017.8396357%2C18.6057347%2017.8396357%2C18.6057347%20C18.0063789%2C19.7362273%2017.9024408%2C19.5438313%2017.9024408%2C19.5438313%20L17.1125113%2C19.6393659%20C17.1232047%2C19.896452%2017.1022601%2C20.1538778%2017.0501485%2C20.405854%20C16.12134%2C20.8198372%2015.921425%2C21.0626543%2014.9983663%2C21.4673494%20C13.215054%2C22.2488754%2011.2769403%2C23.2652573%2010.9323966%2C24.6337018%20C10.5878529%2C26.0021463%209.56350982%2C31.4100231%209.56350982%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4364902%2C31.4100231%20Z%22/%3E%0A%3C/svg%3E%0A')")
                    )
                    .bind("click", function () {
                        filterResponsible(_$(this));
                    })
                    .toggleClass("filtered", $parent.attr("rel") === name)
                    .append(
                        _$("<div>").text(
                            // Prüfe ob es Zeiterfassung (Sekunden >= 3600) oder Story Points ist
                            (spent[id] >= 3600 ? formatTime(spent[id]) : formatStoryPoints(spent[id]) + "h") + " / " +
                            (estimations[id] >= 3600 ? formatTime(estimations[id]) : formatStoryPoints(estimations[id]) + "h") +
                            (rest[id] ? (" (Rest: " + (rest[id] >= 3600 ? formatTime(rest[id]) : formatStoryPoints(rest[id]) + "h") + ")") : "")
                        )
                    ).appendTo($bxSums);
            }
        }

        if (totalEstimated > 0) {
            _$("<li>")
                .addClass("totals")
                .css("background-color", titleBg)
                .css("color", titleColor)
                .bind("click", function () {
                    filterResponsible(_$(this), null);
                })
            .append(
                _$("<div>")
                .html('<svg viewBox="0 0 24 24"><path fill="' + titleColor + '" d="M12,6A3,3 0 0,0 9,9A3,3 0 0,0 12,12A3,3 0 0,0 15,9A3,3 0 0,0 12,6M6,8.17A2.5,2.5 0 0,0 3.5,10.67A2.5,2.5 0 0,0 6,13.17C6.88,13.17 7.65,12.71 8.09,12.03C7.42,11.18 7,10.15 7,9C7,8.8 7,8.6 7.04,8.4C6.72,8.25 6.37,8.17 6,8.17M18,8.17C17.63,8.17 17.28,8.25 16.96,8.4C17,8.6 17,8.8 17,9C17,10.15 16.58,11.18 15.91,12.03C16.35,12.71 17.12,13.17 18,13.17A2.5,2.5 0 0,0 20.5,10.67A2.5,2.5 0 0,0 18,8.17M12,14C10,14 6,15 6,17V19H18V17C18,15 14,14 12,14M4.67,14.97C3,15.26 1,16.04 1,17.33V19H4V17C4,16.22 4.29,15.53 4.67,14.97M19.33,14.97C19.71,15.53 20,16.22 20,17V19H23V17.33C23,16.04 21,15.26 19.33,14.97Z" /></svg>')
            ).append(
                _$("<div>").text(
                    (totalSpent >= 3600 ? formatTime(totalSpent) : formatStoryPoints(totalSpent) + "h") + " / " +
                    (totalEstimated >= 3600 ? formatTime(totalEstimated) : formatStoryPoints(totalEstimated) + "h")
                    + (totalRest ? " (Rest: " + (totalRest >= 3600 ? formatTime(totalRest) : formatStoryPoints(totalRest) + "h") + ")" : "")
                )
            ).appendTo($bxSums);
            _$("<div>").addClass("triangle").css("border-right", "8px solid " + titleBg).appendTo($bxSums);
            _$("<div>").addClass("band").css("background-color", titleBg).appendTo($bxSums);
            _$("<div>").addClass("triangleR").css("border-left", "8px solid " + titleBg).appendTo($bxSums);
            _$("<div>").addClass("bandR").css("background-color", titleBg).appendTo($bxSums);
            $bxSums.show();
        }
    } else {
        $bxSums.detach();
    }
}

function filterResponsible ($li) {
    var
        $column = $li.parents(".main-kanban-column, .tasks-scrum__content"),
        $items = $column.find(".main-kanban-item, .tasks-scrum__item"),
        responsible = $li.data("name"),
        newFilter = responsible || false;

    if ($li.hasClass("filtered")) {
        newFilter = false;
    }
    $items.each(function () {
        var $responsibleEl = _$(this).find(".tasks-kanban-item-responsible-sprint .tasks-kanban-item-author-avatar, .tasks-kanban-item-responsible .tasks-kanban-item-author-avatar, .tasks-scrum__item--responsible span");
        var itemResponsible = $responsibleEl.attr("title") || $responsibleEl.text().trim();
        _$(this).toggle(
            !newFilter || responsible === itemResponsible
        );
    });
    $column.find(".customBxSums li").removeClass("filtered");
    $li.toggleClass("filtered", !!newFilter);
    $column.attr("rel", newFilter);
}

function cssLoaded() {
    if (!_$("#bxSumsLink").length) {
        return false;
    }
    return Boolean(_$("#bxSumsLink").get(0).sheet);
}

function formatStoryPoints(points) {
    if (!points || points <= 0) {
        return "0";
    }
    // Formatiere mit Komma als Dezimaltrennzeichen
    return points.toString().replace('.', ',');
}

function formatTime (totalSeconds) {
    var
        hours = totalSeconds > 0 ? Math.floor(totalSeconds / 3600) : Math.ceil(totalSeconds / 3600),
        totSeconds = totalSeconds % 3600,
        minutes = Math.round(Math.abs(Math.floor(totSeconds / 60) / 6 * 10), 0),
        seconds = totSeconds % 60;

    if (!totalSeconds || totalSeconds < 0) {
        return "0h";
    }
    return (hours + "," + (minutes < 10 ? "0" + minutes : minutes) + "h").replace(/(,00h|0h)$/, "h");
}

function timeStrToSeconds (timeStr) {
    var
        splitted = timeStr.split(/[.,]/);

    if (splitted.length === 1) {
        return parseInt(splitted[0]) * 3600;
    } else if (splitted.length === 2 && parseInt(splitted[1]) > 0) {
        return parseInt(splitted[0]) * 3600
            + 60 / 10 * parseInt(splitted[1]) * 60;
    }

    return 0;
}

function loadAllItems($col, column) {
    var
      pagination = column.getPagination(),
      columnId = column.id;

    // Wenn sich die Anzahl der Items nach maxLoadingSecondsPerColumn nicht veraendert, gehen wir davon aus dass es keine weiteren Items mehr zu laden gibt...
    if (loadingPagesCount[columnId] && (Date.now() / 1000) - loadingPagesCount[columnId].start > maxLoadingSecondsPerColumn && column.getItemsCount() === loadingPagesCount[columnId].items) {
        return;
    }

    if (column.hasLoading()) {
        if (!pagination.loadingInProgress) {
            if (!loadingPagesCount[columnId]) {
                loadingPagesCount[columnId] = {
                    start: Date.now() / 1000,
                    items: column.getItemsCount()
                };
            }
            pagination.loadItems();
        }

        _.delay(function () {
            loadAllItems($col, column);
        }, 100);
    }
}

// Sprint-Ansicht Funktionen
function prepareSprints() {
    if (!useCalc()) {
        return;
    }

    // Sprints berechnen
    _$(".tasks-scrum__sprints .tasks-scrum__content").each(function() {
        var $sprint = _$(this);
        var $container = $sprint.find(".tasks-scrum__content-container");

        if ($container.length && !$container.hasClass("sprint-calculated")) {
            calculateSprintFromDOM($sprint);
            $container.addClass("sprint-calculated");

            // Füge MutationObserver hinzu um bei neuen Tasks neu zu berechnen
            setupSprintObserver($sprint);
        }
    });

    // Backlog berechnen
    _$(".tasks-scrum__backlog .tasks-scrum__content").each(function() {
        var $backlog = _$(this);
        var $items = $backlog.find(".tasks-scrum__content-items");

        if ($items.length && !$items.hasClass("backlog-calculated")) {
            calculateBacklogFromDOM($backlog);
            $items.addClass("backlog-calculated");
        }
    });
}

function calculateBacklogFromDOM($backlog) {
    var
        $bxSums = $backlog.find(".customBxSums"),
        $header = $backlog.find(".tasks-scrum__content-header"),
        $items = $backlog.find(".tasks-scrum__item"),
        taskCounts = {},
        responsibles = {},
        totalTasks = 0;

    if (!$items.length) {
        $bxSums.detach();
        return;
    }

    // Zähle Aufgaben pro Verantwortlichem
    $items.each(function() {
        var
            $item = _$(this),
            $responsibleEl = $item.find(".tasks-scrum__item--responsible span"),
            $responsiblePhotoEl = $item.find(".tasks-scrum__item--responsible-photo i"),
            responsibleName = $responsibleEl.text().trim() || "Unbekannt",
            responsibleImg = $responsiblePhotoEl.css("background-image");

        if (!taskCounts[responsibleName]) {
            taskCounts[responsibleName] = 0;
        }

        responsibles[responsibleName] = {
            name: responsibleName,
            photo: responsibleImg
        };

        taskCounts[responsibleName] += 1;
        totalTasks += 1;
    });

    // Erstelle oder aktualisiere die Anzeige
    if (totalTasks > 0) {
        if (!$bxSums.length) {
            $bxSums = _$("<ul>")
                .addClass("customBxSums customBxSums-backlog")
                .css({
                    'list-style': 'none',
                    'padding': '6px 10px',
                    'margin': '0 0 6px 0',
                    'background': '#fff',
                    'border-radius': '4px',
                    'box-shadow': '0 1px 2px rgba(0,0,0,0.08)'
                });
            $header.after($bxSums);
        }
        $bxSums.empty();

        // Zeige Aufgaben pro Verantwortlichem
        for (var name in responsibles) {
            var
                r = responsibles[name] || {},
                icon = r.photo;

            if (taskCounts[name] > 0) {
                _$("<li>")
                    .addClass("uSum")
                    .data("name", name)
                    .css({
                        'display': 'flex',
                        'align-items': 'center',
                        'gap': '6px',
                        'padding': '3px 0',
                        'font-size': '12px',
                        'cursor': 'pointer'
                    })
                    .append(
                        _$("<div>")
                            .attr("title", name)
                            .addClass("tasks-kanban-item-author-avatar")
                            .css({
                                'width': '20px',
                                'height': '20px',
                                'border-radius': '50%',
                                'background-size': 'cover',
                                'background-position': 'center',
                                'flex-shrink': '0',
                                'background-image': icon || "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2040%2040%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23525C68%22/%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M30.4364902%2C31.4100231%20C30.4364902%2C29.9871769%2028.8398242%2C23.9680557%2028.8398242%2C23.9680557%20C28.8398242%2C23.0883414%2027.6898708%2C22.083459%2025.4253473%2C21.4978674%20C24.6581347%2C21.2838747%2023.9288072%2C20.9520366%2023.2634349%2C20.514215%20C23.1179216%2C20.4310645%2023.1400361%2C19.6628072%2023.1400361%2C19.6628072%20L22.4107003%2C19.5517925%20C22.4107003%2C19.4894296%2022.3483374%2C18.5681401%2022.3483374%2C18.5681401%20C23.2209751%2C18.274902%2023.1311903%2C16.5451067%2023.1311903%2C16.5451067%20C23.6853794%2C16.8524981%2024.0462878%2C15.4836113%2024.0462878%2C15.4836113%20C24.7017612%2C13.5817654%2023.719878%2C13.6967607%2023.719878%2C13.6967607%20C23.8916546%2C12.5357299%2023.8916546%2C11.3557413%2023.719878%2C10.1947105%20C23.283338%2C6.34325128%2016.7109122%2C7.38882426%2017.4902268%2C8.64669632%20C15.5693624%2C8.29286451%2016.0076715%2C12.6635719%2016.0076715%2C12.6635719%20L16.4243085%2C13.7953913%20C15.6060724%2C14.326139%2016.1748571%2C14.9679015%2016.2031636%2C15.7065254%20C16.243412%2C16.7972119%2016.9108272%2C16.5712018%2016.9108272%2C16.5712018%20C16.9519602%2C18.3713211%2017.8396357%2C18.6057347%2017.8396357%2C18.6057347%20C18.0063789%2C19.7362273%2017.9024408%2C19.5438313%2017.9024408%2C19.5438313%20L17.1125113%2C19.6393659%20C17.1232047%2C19.896452%2017.1022601%2C20.1538778%2017.0501485%2C20.405854%20C16.12134%2C20.8198372%2015.921425%2C21.0626543%2014.9983663%2C21.4673494%20C13.215054%2C22.2488754%2011.2769403%2C23.2652573%2010.9323966%2C24.6337018%20C10.5878529%2C26.0021463%209.56350982%2C31.4100231%209.56350982%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4364902%2C31.4100231%20Z%22/%3E%0A%3C/svg%3E%0A')"
                            })
                    )
                    .bind("click", function () {
                        filterResponsible(_$(this));
                    })
                    .append(
                        _$("<div>").text(
                            taskCounts[name] + (taskCounts[name] === 1 ? " Aufgabe" : " Aufgaben")
                        )
                    ).appendTo($bxSums);
            }
        }

        // Zeige Gesamtsumme - HERVORGEHOBEN
        if (totalTasks > 0) {
            _$("<li>")
                .addClass("totals")
                .css({
                    'display': 'flex',
                    'align-items': 'center',
                    'gap': '6px',
                    'padding': '6px 8px',
                    'margin-top': '4px',
                    'background-color': '#4a90e2',
                    'color': '#fff',
                    'border-radius': '4px',
                    'font-weight': 'bold',
                    'font-size': '12px',
                    'cursor': 'pointer'
                })
                .bind("click", function () {
                    filterResponsible(_$(this), null);
                })
            .append(
                _$("<div>")
                    .css({
                        'width': '20px',
                        'height': '20px',
                        'display': 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'flex-shrink': '0'
                    })
                .html('<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#fff" d="M12,6A3,3 0 0,0 9,9A3,3 0 0,0 12,12A3,3 0 0,0 15,9A3,3 0 0,0 12,6M6,8.17A2.5,2.5 0 0,0 3.5,10.67A2.5,2.5 0 0,0 6,13.17C6.88,13.17 7.65,12.71 8.09,12.03C7.42,11.18 7,10.15 7,9C7,8.8 7,8.6 7.04,8.4C6.72,8.25 6.37,8.17 6,8.17M18,8.17C17.63,8.17 17.28,8.25 16.96,8.4C17,8.6 17,8.8 17,9C17,10.15 16.58,11.18 15.91,12.03C16.35,12.71 17.12,13.17 18,13.17A2.5,2.5 0 0,0 20.5,10.67A2.5,2.5 0 0,0 18,8.17M12,14C10,14 6,15 6,17V19H18V17C18,15 14,14 12,14M4.67,14.97C3,15.26 1,16.04 1,17.33V19H4V17C4,16.22 4.29,15.53 4.67,14.97M19.33,14.97C19.71,15.53 20,16.22 20,17V19H23V17.33C23,16.04 21,15.26 19.33,14.97Z" /></svg>')
            ).append(
                _$("<div>").text(
                    totalTasks + (totalTasks === 1 ? " Aufgabe" : " Aufgaben")
                )
            ).appendTo($bxSums);
        }
    } else {
        $bxSums.detach();
    }
}

function setupSprintObserver($sprint) {
    var $itemsContainer = $sprint.find(".tasks-scrum__content-items");
    if (!$itemsContainer.length) {
        return;
    }

    // Verhindere mehrfache Observer
    if ($sprint.data("observer-installed")) {
        return;
    }
    $sprint.data("observer-installed", true);

    // Erstelle MutationObserver der auf neue Tasks reagiert
    var lastKnownCount = $sprint.find(".tasks-scrum__item:not(.tasks-scrum-entity-items-loader)").length;
    var recalculateTimer = null;

    function checkAndRecalculate() {
        // Zähle aktuelle Tasks
        var currentCount = $sprint.find(".tasks-scrum__item:not(.tasks-scrum-entity-items-loader)").length;

        // Prüfe ob sich die Anzahl geändert hat
        if (currentCount !== lastKnownCount) {
            lastKnownCount = currentCount;
            $sprint.data("loading-completed", true);

            // Prüfe ob jetzt alle Tasks geladen sind
            var $items = $sprint.find(".tasks-scrum__item:not(.tasks-scrum-entity-items-loader)");
            var $bitrixCount = $sprint.find(".tasks-scrum__sprint--point[data-hint='Aufgaben']");
            var bitrixTotalCount = 0;
            if ($bitrixCount.length) {
                bitrixTotalCount = parseInt($bitrixCount.text().trim()) || 0;
            }

            if (bitrixTotalCount > 0 && $items.length >= bitrixTotalCount) {
                showSuccessMessage($sprint);
            }

            calculateSprintFromDOM($sprint);
        }
    }

    var observer = new MutationObserver(function(mutations) {
        // Debounce mit kürzerer Zeit
        clearTimeout(recalculateTimer);
        recalculateTimer = setTimeout(checkAndRecalculate, 300);
    });

    // Starte Observer
    observer.observe($itemsContainer[0], {
        childList: true,
        subtree: true
    });

    // Zusätzlich: Scroll-Listener der regelmäßig prüft
    var scrollTimer = null;
    $itemsContainer.on('scroll', function() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function() {
            checkAndRecalculate();
        }, 800);
    });
}

function showSuccessMessage($sprint) {
    // Entferne Warnung
    $sprint.find(".scroll-warning-banner").remove();

    // Zeige kurze Erfolgsmeldung
    var $success = _$("<div>")
        .css({
            'position': 'relative',
            'z-index': '9999',
            'background': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            'color': '#fff',
            'padding': '12px 16px',
            'margin': '15px 10px 15px 10px',
            'border-radius': '8px',
            'box-shadow': '0 4px 12px rgba(40, 167, 69, 0.4)',
            'display': 'flex',
            'align-items': 'center',
            'gap': '12px',
            'font-size': '14px',
            'font-weight': '600',
            'border': '2px solid rgba(255, 255, 255, 0.3)',
            'animation': 'slideDown 0.3s ease-out'
        })
        .html(
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" style="flex-shrink: 0;">' +
            '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>' +
            '</svg>' +
            '<div style="flex: 1; font-weight: 700;">✓ Alle Aufgaben geladen - Berechnung aktualisiert!</div>'
        );

    var $container = $sprint.find(".tasks-scrum__content-header");
    if ($container.length) {
        $container.after($success);

        // Auto-remove nach 3 Sekunden
        setTimeout(function() {
            $success.fadeOut(300, function() {
                _$(this).remove();
            });
        }, 3000);
    }
}

function showScrollWarning($sprint, total, loaded) {
    // Entferne alte Warnung falls vorhanden
    $sprint.find(".scroll-warning-banner").remove();
    _$(".scroll-warning-banner").remove();

    var $warning = _$("<div>")
        .addClass("scroll-warning-banner")
        .css({
            'position': 'relative',
            'z-index': '9999',
            'background': 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
            'color': '#fff',
            'padding': '10px 14px',
            'margin': '10px 10px 8px 10px',
            'border-radius': '6px',
            'box-shadow': '0 4px 12px rgba(238, 90, 111, 0.4)',
            'display': 'flex',
            'align-items': 'center',
            'gap': '10px',
            'font-size': '13px',
            'font-weight': '600',
            'border': '2px solid rgba(255, 255, 255, 0.3)'
        })
        .html(
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">' +
            '<path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18.5c-3.9-.96-7-5.43-7-9.5V8.3l7-3.11 7 3.11V11c0 4.07-3.1 8.54-7 9.5z" fill="white"/>' +
            '<path d="M11 7h2v7h-2zm0 8h2v2h-2z" fill="white"/>' +
            '</svg>' +
            '<div style="flex: 1; line-height: 1.5;">' +
            '<div style="font-weight: 700; margin-bottom: 2px;">⚠️ Nur ' + loaded + ' von ' + total + ' Aufgaben geladen</div>' +
            '<div style="font-size: 11px; opacity: 0.95;">Scrollen Sie nach unten - Berechnung wird automatisch aktualisiert</div>' +
            '</div>' +
            '<button style="background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.35)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.25)\'" onclick="this.parentElement.remove()">OK</button>'
        );

    // Füge CSS für Pulse-Animation hinzu
    if (!_$("#scroll-warning-pulse").length) {
        _$("<style>")
            .attr("id", "scroll-warning-pulse")
            .text("@keyframes pulse { 0%, 100% { box-shadow: 0 6px 16px rgba(238, 90, 111, 0.5); } 50% { box-shadow: 0 6px 24px rgba(238, 90, 111, 0.8); } }")
            .appendTo("head");
    }

    // Versuche verschiedene Container
    var $container = $sprint.find(".tasks-scrum__content-header");
    if ($container.length) {
        $container.after($warning);
        return;
    }

    $container = $sprint.find(".tasks-scrum__content-items");
    if ($container.length) {
        $container.prepend($warning);
        return;
    }

    $container = $sprint.find(".tasks-scrum__content-container");
    if ($container.length) {
        $container.prepend($warning);
        return;
    }
}

function loadAllSprintItemsViaAPI($sprint, sprintId) {
    var signedParameters = getSignedParameters();
    if (!signedParameters) {
        loadAllSprintItemsFallback($sprint, sprintId, 1);
        return;
    }

    var pageNumber = 2;
    var pageSize = 10;
    var allTasksLoaded = [];

    function loadNextPage() {
        _$.ajax({
            url: '/bitrix/services/main/ajax.php?mode=class&c=bitrix%3Atasks.scrum&action=getItems',
            method: 'POST',
            data: {
                entityId: sprintId,
                pageNumber: pageNumber,
                pageSize: pageSize,
                debugMode: 'N',
                signedParameters: signedParameters
            },
            success: function(response) {
                if (response && response.status === 'error') {
                    loadAllSprintItemsFallback($sprint, sprintId, 1);
                    return;
                }

                if (response && response.data && response.data.html) {
                    var $container = $sprint.find(".tasks-scrum__content-items");
                    var $loader = $sprint.find(".tasks-scrum-entity-items-loader");

                    if ($loader.length) {
                        _$(response.data.html).insertBefore($loader);
                    } else {
                        $container.append(response.data.html);
                    }

                    allTasksLoaded.push(response.data);

                    if (response.data.hasMorePages || (response.data.items && response.data.items.length === pageSize)) {
                        pageNumber++;
                        setTimeout(loadNextPage, 300);
                    } else {
                        $sprint.data("loading-completed", true);
                        calculateSprintFromDOM($sprint);
                    }
                } else {
                    $sprint.data("loading-completed", true);
                    calculateSprintFromDOM($sprint);
                }
            },
            error: function(xhr, status, error) {
                loadAllSprintItemsFallback($sprint, sprintId, 1);
            }
        });
    }

    loadNextPage();
}

function getSignedParameters() {
    // 1. Versuche aus BX.Tasks.Scrum Komponente
    if (typeof BX !== 'undefined' && BX.Tasks && BX.Tasks.Scrum) {
        try {
            var scrumComponents = document.querySelectorAll('[data-id^="tasks-scrum"]');
            for (var i = 0; i < scrumComponents.length; i++) {
                var el = scrumComponents[i];
                if (el.__component && el.__component.signedParameters) {
                    return el.__component.signedParameters;
                }
            }
        } catch (e) {}
    }

    // 2. Suche im Vue/React Component Data
    try {
        var $scrum = _$('.tasks-scrum');
        if ($scrum.length && $scrum[0].__vue__) {
            var vueData = $scrum[0].__vue__;
            if (vueData && vueData.signedParameters) {
                return vueData.signedParameters;
            }
        }
    } catch (e) {}

    // 3. Suche in allen Script-Tags nach der Komponenten-Initialisierung
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
        var scriptContent = scripts[i].textContent;

        var match = scriptContent.match(/signedParameters['":\s]+["']([^"']+)["']/);
        if (match && match[1]) {
            return match[1];
        }

        match = scriptContent.match(/"signedParameters":"([^"]+)"/);
        if (match && match[1]) {
            return match[1];
        }
    }

    // 4. Letzte Möglichkeit: Lese aus einem bereits durchgeführten AJAX-Request
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        try {
            var resources = performance.getEntriesByType('resource');
            for (var i = resources.length - 1; i >= 0; i--) {
                var url = resources[i].name;
                if (url.includes('tasks.scrum') && url.includes('signedParameters=')) {
                    var match = url.match(/signedParameters=([^&]+)/);
                    if (match && match[1]) {
                        return decodeURIComponent(match[1]);
                    }
                }
            }
        } catch (e) {}
    }

    return null;
}

function loadAllSprintItemsFallback($sprint, sprintId, attempt) {
    attempt = attempt || 1;

    var $itemsContainer = $sprint.find(".tasks-scrum__content-items");
    if (!$itemsContainer.length) {
        return;
    }

    var container = $itemsContainer[0];
    var currentCount = $sprint.find(".tasks-scrum__item:not(.tasks-scrum-entity-items-loader)").length;

    var tracking = $sprint.data("loading-tracking");
    if (!tracking) {
        tracking = {
            startCount: currentCount,
            lastCount: currentCount,
            sameCountAttempts: 0
        };
        $sprint.data("loading-tracking", tracking);
    }

    var scrollHeight = container.scrollHeight;
    var clientHeight = container.clientHeight;
    var maxScroll = scrollHeight - clientHeight;

    container.scrollTop = maxScroll * 0.2;
    setTimeout(function() {
        container.scrollTop = maxScroll * 0.4;
    }, 300);
    setTimeout(function() {
        container.scrollTop = maxScroll * 0.6;
    }, 600);
    setTimeout(function() {
        container.scrollTop = maxScroll * 0.8;
    }, 900);
    setTimeout(function() {
        container.scrollTop = maxScroll;
    }, 1200);

    _.delay(function() {
        var newCount = $sprint.find(".tasks-scrum__item:not(.tasks-scrum-entity-items-loader)").length;
        var hasLoader = $sprint.find(".tasks-scrum-entity-items-loader.--waiting").length > 0;

        if (newCount === tracking.lastCount) {
            tracking.sameCountAttempts++;
        } else {
            tracking.sameCountAttempts = 0;
            tracking.lastCount = newCount;
        }

        var expectedCount = $sprint.data("expected-count") || 0;
        var foundAllTasks = (expectedCount > 0 && newCount >= expectedCount);

        var shouldStop = tracking.sameCountAttempts >= 5 || foundAllTasks;
        var maxAttemptsReached = attempt >= 20;

        if (shouldStop || maxAttemptsReached) {
            container.scrollTop = 0;
            $sprint.removeData("loading-tracking");
            $sprint.data("loading-completed", true);
            calculateSprintFromDOM($sprint);
        } else {
            loadAllSprintItemsFallback($sprint, sprintId, attempt + 1);
        }
    }, 2000);
}

function calculateSprintFromDOM($sprint) {
    var
        $container = $sprint.find(".tasks-scrum__content-container"),
        $bxSums = $sprint.find(".customBxSums"),
        $header = $sprint.find(".tasks-scrum__content-header"),
        $items = $sprint.find(".tasks-scrum__item:not(.tasks-scrum-entity-items-loader)"),
        estimations = {},
        spent = {},
        rest = {},
        responsibles = {},
        taskCounts = {},
        totalRest = 0,
        totalSpent = 0,
        totalEstimated = 0,
        totalTasks = 0;

    var $bitrixCount = $sprint.find(".tasks-scrum__sprint--point[data-hint='Aufgaben']");
    var bitrixTotalCount = 0;
    if ($bitrixCount.length) {
        bitrixTotalCount = parseInt($bitrixCount.text().trim()) || 0;
        if (bitrixTotalCount > $items.length) {
            showScrollWarning($sprint, bitrixTotalCount, $items.length);
        } else {
            $sprint.find(".scroll-warning-banner").remove();
        }
    }

    if (!$items.length) {
        $bxSums.detach();
        return;
    }

    var hasLoader = $sprint.find(".tasks-scrum-entity-items-loader.--waiting").length > 0;
    var sprintId = $sprint.attr("data-sprint-id");
    var sprintName = $sprint.find(".tasks-scrum__title").text() || "Sprint " + sprintId;
    var loadingCompleted = $sprint.data("loading-completed");

    if (hasLoader && !$sprint.data("force-loading-started") && !loadingCompleted) {
        $sprint.data("force-loading-started", true);
        $sprint.data("expected-count", bitrixTotalCount);
        return;
    }

    // Sammle eindeutige Task-IDs um Duplikate zu vermeiden
    var processedTaskIds = {};

    // Sammle Story Points und Rest aus dem DOM
    $items.each(function() {
        var
            $item = _$(this),
            taskId = $item.attr("data-id"),
            $storyPointsEl = $item.find(".tasks-scrum__item--story-points-element-text"),
            $responsibleEl = $item.find(".tasks-scrum__item--responsible span"),
            $hashtagEl = $item.find(".tasks-scrum__item--hashtag"),
            $responsiblePhotoEl = $item.find(".tasks-scrum__item--responsible-photo i"),
            responsibleName = $responsibleEl.text().trim() || "Unbekannt",
            responsibleImg = $responsiblePhotoEl.css("background-image"),
            points = 0,
            pointsRest = 0;

        // Überspringe Duplikate
        if (taskId && processedTaskIds[taskId]) {
            return; // continue in jQuery.each
        }
        if (taskId) {
            processedTaskIds[taskId] = true;
        }

        // Lese Story Points
        if ($storyPointsEl.length) {
            var pointsText = $storyPointsEl.text().trim();
            if (pointsText !== '-') {
                points = parseFloat(pointsText) || 0;
                pointsRest = points; // Default: Rest = Story Points (noch nichts erledigt)
            }
        }

        // Suche nach Rest-Tags
        if ($hashtagEl.length) {
            var tagText = $hashtagEl.text().trim();
            if (tagText) {
                // Entferne # am Anfang falls vorhanden
                var cleanTag = tagText.replace(/^#/, '');
                var match = cleanTag.match(/^Rest\s*:?\s*([\d.,]+)\s*?$/i);
                if (match && match.length > 1) {
                    pointsRest = parseFloat(match[1].replace(',', '.')) || 0;
                }
            }
        }

        // Zähle alle Aufgaben, auch ohne Story Points
        if (!taskCounts[responsibleName]) {
            taskCounts[responsibleName] = 0;
        }

        if (!responsibles[responsibleName]) {
            responsibles[responsibleName] = {
                name: responsibleName,
                photo: responsibleImg
            };
        }

        taskCounts[responsibleName] += 1;
        totalTasks += 1;

        if (points > 0) {
            if (!spent[responsibleName]) {
                spent[responsibleName] = 0;
            }

            if (!estimations[responsibleName]) {
                estimations[responsibleName] = 0;
            }

            if (!rest[responsibleName]) {
                rest[responsibleName] = 0;
            }

            // Bei Story Points: Spent = Estimated - Rest
            var pointsSpent = points - pointsRest;

            spent[responsibleName] += pointsSpent;
            estimations[responsibleName] += points;
            rest[responsibleName] += pointsRest;

            totalSpent += pointsSpent;
            totalEstimated += points;
            totalRest += pointsRest;
        }
    });

    // Erstelle oder aktualisiere die Anzeige
    if (totalEstimated > 0) {
        if (!$bxSums.length) {
            $bxSums = _$("<ul>")
                .addClass("customBxSums customBxSums-sprint")
                .css({
                    'list-style': 'none',
                    'padding': '6px 10px',
                    'margin': '0 0 6px 0',
                    'background': '#fff',
                    'border-radius': '4px',
                    'box-shadow': '0 1px 2px rgba(0,0,0,0.08)'
                });
            $container.before($bxSums);
        }
        $bxSums.empty();

        // Zeige Story Points pro Verantwortlichem
        for (var name in responsibles) {
            var
                r = responsibles[name] || {},
                icon = r.photo;

            // Zeige alle Personen mit Aufgaben (nicht nur die mit Story Points)
            if (taskCounts[name] > 0) {
                var displayText = "";

                // Story Points anzeigen, wenn vorhanden
                if (estimations[name] > 0) {
                    displayText = formatStoryPoints(estimations[name]) + "h" +
                        (rest[name] ? " (Rest: " + formatStoryPoints(rest[name]) + "h)" : "");
                } else {
                    displayText = "0h";
                }

                // Anzahl der Aufgaben hinzufügen
                displayText += " | " + taskCounts[name] + (taskCounts[name] === 1 ? " Aufgabe" : " Aufgaben");

                _$("<li>")
                    .addClass("uSum")
                    .data("name", name)
                    .css({
                        'display': 'flex',
                        'align-items': 'center',
                        'gap': '6px',
                        'padding': '3px 0',
                        'font-size': '12px',
                        'cursor': 'pointer'
                    })
                    .append(
                        _$("<div>")
                            .attr("title", name)
                            .addClass("tasks-kanban-item-author-avatar")
                            .css({
                                'width': '20px',
                                'height': '20px',
                                'border-radius': '50%',
                                'background-size': 'cover',
                                'background-position': 'center',
                                'flex-shrink': '0',
                                'background-image': icon || "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2040%2040%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23525C68%22/%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M30.4364902%2C31.4100231%20C30.4364902%2C29.9871769%2028.8398242%2C23.9680557%2028.8398242%2C23.9680557%20C28.8398242%2C23.0883414%2027.6898708%2C22.083459%2025.4253473%2C21.4978674%20C24.6581347%2C21.2838747%2023.9288072%2C20.9520366%2023.2634349%2C20.514215%20C23.1179216%2C20.4310645%2023.1400361%2C19.6628072%2023.1400361%2C19.6628072%20L22.4107003%2C19.5517925%20C22.4107003%2C19.4894296%2022.3483374%2C18.5681401%2022.3483374%2C18.5681401%20C23.2209751%2C18.274902%2023.1311903%2C16.5451067%2023.1311903%2C16.5451067%20C23.6853794%2C16.8524981%2024.0462878%2C15.4836113%2024.0462878%2C15.4836113%20C24.7017612%2C13.5817654%2023.719878%2C13.6967607%2023.719878%2C13.6967607%20C23.8916546%2C12.5357299%2023.8916546%2C11.3557413%2023.719878%2C10.1947105%20C23.283338%2C6.34325128%2016.7109122%2C7.38882426%2017.4902268%2C8.64669632%20C15.5693624%2C8.29286451%2016.0076715%2C12.6635719%2016.0076715%2C12.6635719%20L16.4243085%2C13.7953913%20C15.6060724%2C14.326139%2016.1748571%2C14.9679015%2016.2031636%2C15.7065254%20C16.243412%2C16.7972119%2016.9108272%2C16.5712018%2016.9108272%2C16.5712018%20C16.9519602%2C18.3713211%2017.8396357%2C18.6057347%2017.8396357%2C18.6057347%20C18.0063789%2C19.7362273%2017.9024408%2C19.5438313%2017.9024408%2C19.5438313%20L17.1125113%2C19.6393659%20C17.1232047%2C19.896452%2017.1022601%2C20.1538778%2017.0501485%2C20.405854%20C16.12134%2C20.8198372%2015.921425%2C21.0626543%2014.9983663%2C21.4673494%20C13.215054%2C22.2488754%2011.2769403%2C23.2652573%2010.9323966%2C24.6337018%20C10.5878529%2C26.0021463%209.56350982%2C31.4100231%209.56350982%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4364902%2C31.4100231%20Z%22/%3E%0A%3C/svg%3E%0A')"
                            })
                    )
                    .bind("click", function () {
                        filterResponsible(_$(this));
                    })
                    .append(
                        _$("<div>").text(displayText)
                    ).appendTo($bxSums);
            }
        }

        // Zeige Gesamtsumme - HERVORGEHOBEN
        if (totalEstimated > 0) {
            var summaryText = formatStoryPoints(totalEstimated) + "h"
                + (totalRest ? " (Rest: " + formatStoryPoints(totalRest) + "h)" : "")
                + (totalTasks ? " | " + totalTasks + (totalTasks === 1 ? " Aufgabe" : " Aufgaben") : "");

            // Wenn nicht alle Tasks geladen wurden, zeige Warnung
            if (bitrixTotalCount > 0 && totalTasks < bitrixTotalCount) {
                summaryText += " ⚠ " + bitrixTotalCount + " gesamt";
            }

            _$("<li>")
                .addClass("totals")
                .css({
                    'display': 'flex',
                    'align-items': 'center',
                    'gap': '6px',
                    'padding': '6px 8px',
                    'margin-top': '4px',
                    'background-color': (bitrixTotalCount > totalTasks ? '#e67e22' : '#4a90e2'),
                    'color': '#fff',
                    'border-radius': '4px',
                    'font-weight': 'bold',
                    'font-size': '12px',
                    'cursor': 'pointer'
                })
                .attr('title', bitrixTotalCount > totalTasks ? 'Achtung: Nur ' + totalTasks + ' von ' + bitrixTotalCount + ' Tasks geladen. Bitrix Lazy-Loading Limitation.' : '')
                .bind("click", function () {
                    filterResponsible(_$(this), null);
                })
            .append(
                _$("<div>")
                    .css({
                        'width': '20px',
                        'height': '20px',
                        'display': 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'flex-shrink': '0'
                    })
                .html('<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#fff" d="M12,6A3,3 0 0,0 9,9A3,3 0 0,0 12,12A3,3 0 0,0 15,9A3,3 0 0,0 12,6M6,8.17A2.5,2.5 0 0,0 3.5,10.67A2.5,2.5 0 0,0 6,13.17C6.88,13.17 7.65,12.71 8.09,12.03C7.42,11.18 7,10.15 7,9C7,8.8 7,8.6 7.04,8.4C6.72,8.25 6.37,8.17 6,8.17M18,8.17C17.63,8.17 17.28,8.25 16.96,8.4C17,8.6 17,8.8 17,9C17,10.15 16.58,11.18 15.91,12.03C16.35,12.71 17.12,13.17 18,13.17A2.5,2.5 0 0,0 20.5,10.67A2.5,2.5 0 0,0 18,8.17M12,14C10,14 6,15 6,17V19H18V17C18,15 14,14 12,14M4.67,14.97C3,15.26 1,16.04 1,17.33V19H4V17C4,16.22 4.29,15.53 4.67,14.97M19.33,14.97C19.71,15.53 20,16.22 20,17V19H23V17.33C23,16.04 21,15.26 19.33,14.97Z" /></svg>')
            ).append(
                _$("<div>").text(summaryText)
            ).appendTo($bxSums);
        }
    } else {
        $bxSums.detach();
    }
}