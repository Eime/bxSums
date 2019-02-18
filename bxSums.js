// ==UserScript==
// @name         Bitrix-Sums
// @version      1.2
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

    myJQuery("head").append(
        '<link href="https://eime.github.io/bxSums/bxSums.css" rel="stylesheet" type="text/css">'
    );

    if (myJQuery(".main-kanban-column").length) {
        calcEstimations();

        window.setInterval(calcEstimations, 2000);
    }

    // Beim Klick auf den Titel einer Liste werden alle Karten darin in neuen Tabs geoeffnet
    myJQuery(".main-kanban-column-title-info").dblclick(function () {
        myJQuery(this).parents(".main-kanban-column").find(".tasks-kanban-item-title").each(function () {
            window.open(myJQuery(this).attr("href"), "_blank");
        });
    });
})();

function calcEstimations() {
    myJQuery(".main-kanban-column").each(function () {
        var
            $target = myJQuery(this).find(".customBxSums"),
            $cards = myJQuery(this).find(".main-kanban-item"),
            totalDonesAll = 0,
            totalEstimationsAll = 0,
            totalDones = {},
            totalEstimations = {},
            persons = {};

        if (!$target.length) {
            $target = myJQuery("<ul>").addClass("customBxSums");
            myJQuery(".main-kanban-column-header", this).after($target);
        }

        $target.empty().css("display", "none");

        $cards.each(function () {
            var
                $time = myJQuery(this).find(".tasks-kanban-item-timelogs"),
                $responsible = myJQuery(this).find(".tasks-kanban-item-responsible .tasks-kanban-item-author-avatar"),
                responsible = $responsible.length ? $responsible.attr("title") : null;

            if (responsible && $time.length) {
                var
                    splitted = $time.text().split("/"),
                    done = splitted.length ? myJQuery.trim(splitted[0]) : 0,
                    estimation = splitted.length > 1 ? myJQuery.trim(splitted[1]) : 0;

                persons[responsible] = $responsible;

                if (done) {
                    totalDones[responsible] = (totalDones[responsible] || 0) + timeStrToSeconds(done);
                    totalDonesAll += timeStrToSeconds(done);
                }

                if (estimation) {
                    totalEstimations[responsible] = (totalEstimations[responsible] || 0) + timeStrToSeconds(estimation);
                    totalEstimationsAll += timeStrToSeconds(estimation);
                }
            }
        });


        _.each(persons, function ($responsible, responsible) {
            if (totalDones[responsible] || totalEstimations[responsible]) {
                $target.css("display", "flex");
                myJQuery("<li>")
                    .addClass("uSum")
                    .append($responsible.clone())
                    .append(
                        myJQuery("<div>").text(
                            formatTime(totalDones[responsible] || 0) +
                            " / " + (formatTime(totalEstimations[responsible]) || 0)
                        )).appendTo($target);
            }
        });

        if (totalDonesAll || totalEstimationsAll) {
                $target.css("display", "flex");
                myJQuery("<li>")
                    .addClass("totals")
                .append(
                    myJQuery("<div>")
                    .html('<svg viewBox="0 0 24 24"><path fill="#000000" d="M12,6A3,3 0 0,0 9,9A3,3 0 0,0 12,12A3,3 0 0,0 15,9A3,3 0 0,0 12,6M6,8.17A2.5,2.5 0 0,0 3.5,10.67A2.5,2.5 0 0,0 6,13.17C6.88,13.17 7.65,12.71 8.09,12.03C7.42,11.18 7,10.15 7,9C7,8.8 7,8.6 7.04,8.4C6.72,8.25 6.37,8.17 6,8.17M18,8.17C17.63,8.17 17.28,8.25 16.96,8.4C17,8.6 17,8.8 17,9C17,10.15 16.58,11.18 15.91,12.03C16.35,12.71 17.12,13.17 18,13.17A2.5,2.5 0 0,0 20.5,10.67A2.5,2.5 0 0,0 18,8.17M12,14C10,14 6,15 6,17V19H18V17C18,15 14,14 12,14M4.67,14.97C3,15.26 1,16.04 1,17.33V19H4V17C4,16.22 4.29,15.53 4.67,14.97M19.33,14.97C19.71,15.53 20,16.22 20,17V19H23V17.33C23,16.04 21,15.26 19.33,14.97Z" /></svg>')
                 ).append(
                    myJQuery("<div>").text(
                        formatTime(totalDonesAll) +
                        " / " + (formatTime(totalEstimationsAll)) +
                        " (Rest: " + formatTime(totalEstimationsAll-totalDonesAll) + ")"
                    )).appendTo($target);
            }
    });
}

function formatTime (totalSeconds) {
    var
        hours = totalSeconds > 0 ? Math.floor(totalSeconds / 3600) : Math.ceil(totalSeconds / 3600),
        totSeconds = totalSeconds % 3600,
        minutes = Math.abs(Math.floor(totSeconds / 60) / 6 * 10),
        seconds = totSeconds % 60;

    return (hours + "," + minutes + "h").replace(",0", "");
}

function timeStrToSeconds (timeStr) {
    var
        splitted = timeStr.split(":");

    if (splitted.length == 2) {
        return parseInt(splitted[0]) * 3600
            + parseInt(splitted[1]) * 60;
    } else if (splitted.length === 3) {
        return parseInt(splitted[0]) * 3600
            + parseInt(splitted[1]) * 60
            + parseInt(splitted[2]);
    }

    return 0;
}
