// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

var notify = (function () {

'use strict';

var authorized = false;

function isSupported() {
    return window.Notification != undefined;
}

function needEscape() {
    var ua = navigator.userAgent;
    var m = ua.match(/(firefox(?=\/))\/?\s*(\d+)/i) || [];
    return (/firefox/i.test(m[1]));
}

function authorize() {
    return new Promise(function (resolve, reject) {
        if (!isSupported()) {
            reject();
            return;
        }
        Notification.requestPermission(function(perm) {
            authorized = (perm === 'granted');
            resolve(perm);
        });
    });
}

function show(title, body) {
    if (!isSupported())
        return false;
    if (!authorized)
        return false;
    var text = body;
    if (needEscape())
        text = lib.escapeHtml(body);
    var n = new Notification(title, {
        body: text
    });
    setTimeout(n.close.bind(n), 5000);
    return true;
}

return {
    isSupported: isSupported,
    authorize: authorize,
    show: show
};

})();
