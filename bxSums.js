// ==UserScript==
// @name         Bitrix-Sums
// @version      2.5
// @description  Summiert die Stunden in Bitrix-Boards
// @author       Michael E.
// @updateURL    https://eime.github.io/bxSums/bxSums.meta.js
// @downloadURL  https://eime.github.io/bxSums/bxSums.js
// @include      https://bitrix.*.de/*
// @grant        none
// @require https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require https://underscorejs.org/underscore-min.js
// ==/UserScript==

(function() {
    'use strict';
    window.myJQuery = $.noConflict(true);
    window.myTimeouts = {};

    if (myJQuery(".main-kanban-column").length) {
        myJQuery("head").append(
            '<link id="bxSumsLink" href="https://eime.github.io/bxSums/bxSums.css" rel="stylesheet" type="text/css">'
        );

        bxSumsInit();
    }

    // Beim Klick auf den Titel einer Liste werden alle Karten darin in neuen Tabs geoeffnet
    myJQuery(".main-kanban-column-title-info").attr("title", "\u24d8 Doppelklick um alle Karten in neuen Tabs zu öffnen.").dblclick(function () {
        myJQuery(this).parents(".main-kanban-column").find(".tasks-kanban-item-title").each(function () {
            window.open(myJQuery(this).attr("href"), "_blank");
        });
    });
})();

function bxSumsInit() {
    if (!cssLoaded()) {
        window.setTimeout(bxSumsInit, 200);
    } else {
        onCssLoaded();
    }
}

function onCssLoaded() {
    var
        $container = myJQuery(".main-kanban-grid");

    calculateVisibles();

    $container.bind("scroll", calculateVisibles);
}

function calculateVisibles() {
    var
        $container = myJQuery(".main-kanban-grid");

    myJQuery(".main-kanban-column-body").not(".calculated").each(function () {
        var
            $this = myJQuery(this),
            numItems = $this.find(".main-kanban-item").length,
            $parent = $this.parent(),
            left = $parent.position().left;

        // Im Sichtbereich?
        if (!$this.hasClass("calculated") && left > ($this.width() * -1) && left < $container.width()) {
            calculate($this, $this.attr("data-id"), true);
            $this.addClass("calculated");

            if (numItems === 20) {
            scrollToEnd($this);
            }
        }
    });
}

function calculate($list, stageId, addEventHandler) {
    var
        $parent = $list.parent(),
        $bxSums = $parent.find(".customBxSums"),
        column = Kanban.columns[stageId],
        tasks = column.items,
        estimations = {},
        spent = {},
        rest = {},
        responsibles = {},
        totalRest = 0,
        totalSpent = 0,
        totalEstimated = 0;

    if (addEventHandler) {
        BX.addCustomEvent(column, "Kanban.Column:render", function () {
            calculate($list, stageId);
        });
    }

    if (!tasks || !tasks.length) {
        $bxSums.detach();
    } else {
        if (!$bxSums.length) {
            $bxSums = myJQuery("<ul>")
                .addClass("customBxSums");
            $list.before($bxSums);
        }
        $bxSums.empty().hide();

        for (var i = 0; i < tasks.length; i++) {
            var
                task = tasks[i],
                data = task.data,
                responsibleId = data.responsible.id,
                curSpent = parseInt(data.time_logs || 0),
                estimated = parseInt(data.time_estimate || 0),
                curRest = 0,
                foundTag = false,
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
                        foundTag = true;
                        curRest = timeStrToSeconds(match[1]);
                    }
                });
            }

            if (!foundTag) {
                curRest = curSpent > 0 ? 0 : estimated;
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
                r = responsibles[id],
                name = r.name,
                icon = r.photo && r.photo.src;

            if (estimations[id] > 0) {
                myJQuery("<li>")
                    .addClass("uSum")
                    .data("name", name)
                    .css("display", "flex")
                    .append(
                        myJQuery("<div>")
                            .attr("title", name)
                            .addClass("tasks-kanban-item-author-avatar")
                            .css("background-image", "url('" + icon + "'), url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2040%2040%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23525C68%22/%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M30.4364902%2C31.4100231%20C30.4364902%2C29.9871769%2028.8398242%2C23.9680557%2028.8398242%2C23.9680557%20C28.8398242%2C23.0883414%2027.6898708%2C22.083459%2025.4253473%2C21.4978674%20C24.6581347%2C21.2838747%2023.9288072%2C20.9520366%2023.2634349%2C20.514215%20C23.1179216%2C20.4310645%2023.1400361%2C19.6628072%2023.1400361%2C19.6628072%20L22.4107003%2C19.5517925%20C22.4107003%2C19.4894296%2022.3483374%2C18.5681401%2022.3483374%2C18.5681401%20C23.2209751%2C18.274902%2023.1311903%2C16.5451067%2023.1311903%2C16.5451067%20C23.6853794%2C16.8524981%2024.0462878%2C15.4836113%2024.0462878%2C15.4836113%20C24.7017612%2C13.5817654%2023.719878%2C13.6967607%2023.719878%2C13.6967607%20C23.8916546%2C12.5357299%2023.8916546%2C11.3557413%2023.719878%2C10.1947105%20C23.283338%2C6.34325128%2016.7109122%2C7.38882426%2017.4902268%2C8.64669632%20C15.5693624%2C8.29286451%2016.0076715%2C12.6635719%2016.0076715%2C12.6635719%20L16.4243085%2C13.7953913%20C15.6060724%2C14.326139%2016.1748571%2C14.9679015%2016.2031636%2C15.7065254%20C16.243412%2C16.7972119%2016.9108272%2C16.5712018%2016.9108272%2C16.5712018%20C16.9519602%2C18.3713211%2017.8396357%2C18.6057347%2017.8396357%2C18.6057347%20C18.0063789%2C19.7362273%2017.9024408%2C19.5438313%2017.9024408%2C19.5438313%20L17.1125113%2C19.6393659%20C17.1232047%2C19.896452%2017.1022601%2C20.1538778%2017.0501485%2C20.405854%20C16.12134%2C20.8198372%2015.921425%2C21.0626543%2014.9983663%2C21.4673494%20C13.215054%2C22.2488754%2011.2769403%2C23.2652573%2010.9323966%2C24.6337018%20C10.5878529%2C26.0021463%209.56350982%2C31.4100231%209.56350982%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4356056%2C31.4100231%20L30.4364902%2C31.4100231%20Z%22/%3E%0A%3C/svg%3E%0A')")
                    )
                    //.attr("title", "[Stunden lt. Zeiterfassung] / [geschätze Stunden] ([Rest aus Tags])")
                    .bind("click", function () {
                        filterResponsible(myJQuery(this));
                    })
                    .toggleClass("filtered", $parent.attr("rel") === name)
                    .append(
                        myJQuery("<div>").text(
                            formatTime(spent[id]) + " / " +
                            (formatTime(estimations[id])) +
                            (rest[id] ? (" (Rest: " + formatTime(rest[id]) + ")") : "")
                        )
                    ).appendTo($bxSums);
            }
        }

        if (totalEstimated > 0) {
            myJQuery("<li>")
                .addClass("totals")
                .bind("click", function () {
                    filterResponsible(myJQuery(this), null);
                })
            .append(
                myJQuery("<div>")
                .html('<svg viewBox="0 0 24 24"><path fill="#000000" d="M12,6A3,3 0 0,0 9,9A3,3 0 0,0 12,12A3,3 0 0,0 15,9A3,3 0 0,0 12,6M6,8.17A2.5,2.5 0 0,0 3.5,10.67A2.5,2.5 0 0,0 6,13.17C6.88,13.17 7.65,12.71 8.09,12.03C7.42,11.18 7,10.15 7,9C7,8.8 7,8.6 7.04,8.4C6.72,8.25 6.37,8.17 6,8.17M18,8.17C17.63,8.17 17.28,8.25 16.96,8.4C17,8.6 17,8.8 17,9C17,10.15 16.58,11.18 15.91,12.03C16.35,12.71 17.12,13.17 18,13.17A2.5,2.5 0 0,0 20.5,10.67A2.5,2.5 0 0,0 18,8.17M12,14C10,14 6,15 6,17V19H18V17C18,15 14,14 12,14M4.67,14.97C3,15.26 1,16.04 1,17.33V19H4V17C4,16.22 4.29,15.53 4.67,14.97M19.33,14.97C19.71,15.53 20,16.22 20,17V19H23V17.33C23,16.04 21,15.26 19.33,14.97Z" /></svg>')
                ).append(
                myJQuery("<div>").text(
                    formatTime(totalSpent) + " / " +
                    formatTime(totalEstimated)
                    + (totalRest ? " (Rest: " + formatTime(totalRest) + ")" : "")
                )
            ).appendTo($bxSums);
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
        myJQuery(this).toggle(
            !newFilter || responsible === myJQuery(this).find(".tasks-kanban-item-responsible .tasks-kanban-item-author-avatar").attr("title")
        );
    });
    $column.find(".customBxSums li").removeClass("filtered");
    $li.toggleClass("filtered", !!newFilter);
    $column.attr("rel", newFilter);
}

function cssLoaded() {
    if (!myJQuery("#bxSumsLink").length) {
        return false;
    }
    return Boolean(myJQuery("#bxSumsLink").get(0).sheet);
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
    } else if (splitted.length === 1) {
        return parseInt(splitted[0]) * 3600
            + parseInt(splitted[1]) * 60;
    }

    return 0;
}

function scrollToEnd($col, lastNum) {
    var
        numItems = $col.find(".main-kanban-item").length;

    if ((numItems === 20 && !lastNum) || lastNum !== numItems) {
        $col.scrollTop(500000);
        _.delay(function () {
            scrollToEnd($col, numItems);
        }, 500);
    } else {
        $col.scrollTop(0);
    }
}