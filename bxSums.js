// ==UserScript==
// @name         Bitrix-Sums
// @version      2.27
// @description  Summiert die Stunden in Bitrix-Boards
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
            '<link id="bxSumsLink" href="https://eime.github.io/bxSums/bxSumsCards.css?22" rel="stylesheet" type="text/css">'
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

    _$('<span class="menu-popup-item menu-popup-item-none mobi-feature mobi-feature-calc"><span class="menu-popup-item-icon"></span><span class="menu-popup-item-text">Stundensummierung</span></span>')
    .attr("title", "ⓘ Stundensummierung bei den einzelnen Spalten. Tipp: [nocalc] im Titel deaktiviert die Berechnung für einzelne Spalten.")
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
    } else {
        _$(".main-kanban-column-body").removeClass("calculated");
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
                calculate($this, stageId, true);
                $this.addClass("calculated");
                loadAllItems($this, Kanban.columns[stageId]);
            }
        }
    });
}

function calculate($list, stageId, addEventHandler) {
    var
        $parent = $list.parent(),
        $bxSums = $parent.find(".customBxSums"),
        $title = $parent.find(".main-kanban-column-title-text-inner"),
        titleBg = $parent.find(".main-kanban-column-title-bg").css("background-color"),
        titleColor = $title.css("color"),
        column = Kanban.columns[stageId],
        tasks = column ? column.items : [],
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

    //titleBg = titleBg.replace('rgb', 'rgba').replace(')', ', 0.9)');

    if (addEventHandler) {
        BX.addCustomEvent(column.grid, "Kanban.Column:render", function () {
            calculate($list, stageId);
            console.log("rendering", stageId);
            _.delay(prepareColumns, 200);
        });
    }

    if (!tasks || !tasks.length) {
        $bxSums.detach();
    } else {
        if (!$bxSums.length) {
            $bxSums = _$("<ul>")
                .addClass("customBxSums");
            $list.before($bxSums);
        }
        $bxSums.empty().hide();

        for (var i = 0; i < tasks.length; i++) {
            var
                task = tasks[i],
                data = task.data,
                responsibleId = data.responsible && data.responsible.id || "",
                curSpent = parseInt(data.time_logs || 0),
                estimated = parseInt(data.time_estimate || 0),
                curRest = estimated,
                tags = data.tags;

            responsibles[responsibleId] = data.responsible;

            if (!spent[responsibleId]) {
                spent[responsibleId] = 0;
            }

            if (!estimations[responsibleId]) {
                estimations[responsibleId] = 0;
            }

            if (!rest[responsibleId]) {
                rest[responsibleId] = 0;
            }

            if (tags && tags.length) {
                _.each(tags, function (tag) {
                    var
                        match = tag.match(/^Rest.*?([\d.,]+)\s*?$/);
                    if (match && match.length > 1) {
                        curRest = timeStrToSeconds(match[1]);
                    }
                });
            }

            spent[responsibleId] += curSpent;
            estimations[responsibleId] += estimated;
            rest[responsibleId] += curRest;

            totalSpent += curSpent;
            totalRest += curRest;
            totalEstimated += estimated;
        }

        for (var id in responsibles) {
            var
                r = responsibles[id] || {},
                name = r.name,
                icon = r.photo && r.photo.src;

            if (estimations[id] > 0) {
                _$("<li>")
                    .addClass("uSum")
                    .data("name", name)
                    .css("display", "flex")
                    .append(
                        _$("<div>")
                            .attr("title", name)
                            .addClass("tasks-kanban-item-author-avatar")
                            .css("background-image", "url('" + icon + "'), url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2040%2040%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23525C68%22/%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M30.4364902%2C31.4100231%20C30.4364902%2C29.9871769%2028.8398242%2C23.9680557%2028.8398242%2C23.9680557%20C28.8398242%2C23.0883414%2027.6898708%2C22.083459%2025.4253473%2C21.4978674%20C24.6581347%2C21.2838747%2023.9288072%2C20.9520366%2023.2634349%2C20.514215%20C23.1179216%2C20.4310645%2023.1400361%2C19.6628072%2023.1400361%2C19.6628072%20L22.4107003%2C19.5517925%20C22.4107003%2C19.4894296%2022.3483374%2C18.5681401%2022.3483374%2C18.5681401%20C23.2209751%2C18.274902%2023.1311903%2C16.5451067%2023.1311903%2C16.5451067%20C23.6853794%2C16.8524981%2024.0462878%2C15.4836113%2024.0462878%2C15.4836113%20C24.7017612%2C13.5817654%2023.719878%2C13.6967607%2023.719878%2C13.6967607%20C23.8916546%2C12.5357299%2023.8916546%2C11.3557413%2023.719878%2C10.1947105%20C23.283338%2C6.34325128%2016.7109122%2C7.38882426%2017.4902268%2C8.64669632%20C15.5693624%2C8.29286451%2016.0076715%2C12.6635719%2016.0076715%2C12.6635719%20L16.4243085%2C13.7953913%20C15.6060724%2C14.326139%2016.1748571%2C14.9679015%2016.2031636%2C15.7065254%20C16.243412%2C16.7972119%2016.9108272%2C16.5712018%2016.9108272%2C16.5712018%20C16.9519602%2C18.3713211%2017.8396357%2C18.6057347%2017.8396357%2C18.6057347%20C18.0063789%2C19.7362273%2017.9024408%2C19.5438313%2017.9024408%2C19.5438313%20L17.1125113%2C19.6393659%20C17.1232047%2C19.896452%2017.1022601%2C20.1538778%2017.0501485%2C20.405854%20C16.12134%2C20.8198372%2015.921425%2C21.0626543%2014.9983663%2C21.4673494%20C13.215054%2C22.2488754%2011.2769403%2C23.2652573%2010.9323966%2C24.6337018%20C10.5878529%2C26.0021463%209.56350982%2C31.4100231%209.56350982%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4364902%2C31.4100231%20Z%22/%3E%0A%3C/svg%3E%0A')")
                    )
                    //.attr("title", "[Stunden lt. Zeiterfassung] / [geschätze Stunden] ([Rest aus Tags])")
                    .bind("click", function () {
                        filterResponsible(_$(this));
                    })
                    .toggleClass("filtered", $parent.attr("rel") === name)
                    .append(
                        _$("<div>").text(
                            formatTime(spent[id]) + " / " +
                            (formatTime(estimations[id])) +
                            (rest[id] ? (" (Rest: " + formatTime(rest[id]) + ")") : "")
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
                    formatTime(totalSpent) + " / " +
                    formatTime(totalEstimated)
                    + (totalRest ? " (Rest: " + formatTime(totalRest) + ")" : "")
                )
            ).appendTo($bxSums);
            _$("<div>").addClass("triangle").css("border-right", "8px solid " + titleBg).appendTo($bxSums);
            _$("<div>").addClass("band").css("background-color", titleBg).appendTo($bxSums);
            _$("<div>").addClass("triangleR").css("border-left", "8px solid " + titleBg).appendTo($bxSums);
            _$("<div>").addClass("bandR").css("background-color", titleBg).appendTo($bxSums);
            $bxSums.show();
        }
    }
}

function filterResponsible ($li) {
    var
        $column = $li.parents(".main-kanban-column"),
        $items = $column.find(".main-kanban-item"),
        responsible = $li.data("name"),
        newFilter = responsible || false;

    if ($li.hasClass("filtered")) {
        newFilter = false;
    }
    $items.each(function () {
        _$(this).toggle(
            !newFilter || responsible === _$(this).find(".tasks-kanban-item-responsible .tasks-kanban-item-author-avatar").attr("title")
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
