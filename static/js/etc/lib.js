// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

var lib = (function () {
'use strict';

function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2)
        return parts.pop().split(";").shift();
    else
        return '';
}

////////////////////////////////////////////////////////////

function setHandler(event, hash, field) {
    ax.on(event, function (data) {
        var fn = hash[data[field]];
        if (fn)
            fn(data);
    });
}

function doAsync(hash, field, val, msgtype, msgdata) {
    return new Promise(function (resolve) {
        hash[val] = function (data) {
            if (data[field] == val) {
                // remove entry from requests to be GC-ed
                hash[val] = undefined;
                resolve(data);
            }
        };
        ax.send(msgtype, msgdata);
    });
}

function isIEBrowser() {
    var ua = navigator.userAgent;
    var m = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(m[1]))
        return true;
    if (/msie/i.test(m[1]))
        return true;
    return false;
}

function isZeroClipboardSupported() {
    var ua = navigator.userAgent;
    var m = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(m[1]))
        return false;
    if (/msie/i.test(m[1]))
        return false;
    if (/firefox/i.test(m[1]))
        return false;
    return true;
}

function setupZeroClipboard() {
    return new Promise(function (resolve, reject) {
        if (window.ZeroClipboard === undefined) {
            reject();
            return;
        }
        var client = new ZeroClipboard(document.getElementById("copy-btn"));
        client.on('ready', function (readye) {
            client.on('aftercopy', function (e) {
                resolve(e.data["text/plain"]);
            });
        });
    });
}

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

var twelvehour = true;

function timeNow() {
    var now = new Date(),
    h = now.getHours(),
    m = now.getMinutes();

    if (m < 10)
        m = '0' + m;

    if (twelvehour) {
        var a = 'AM';
        if (h >= 12)
            a = 'PM';
        if (h > 12)
            h -= 12;
        if (h == 0)
            h = 12;
        return h + ':' + m + ' ' + a;
    } else {
        return h + ':' + m;
    }
}

return {
    setHandler: setHandler,
    doAsync: doAsync,
    getCookie: getCookie,
    isIEBrowser: isIEBrowser,
    isZeroClipboardSupported: isZeroClipboardSupported,
    setupZeroClipboard: setupZeroClipboard,
    escapeHtml: escapeHtml,
    timeNow: timeNow
};

})();
