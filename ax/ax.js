var ax = (function() {
    'use strict';
    var CID_COOKIE = '__cid__';
    var handlers = {};
    var error_handler;
    var disconnect_handler;
    var raw_handler;
    var ws;
    var connected = false;
    var state = __state;
    __state = undefined;
    state['status'] = 'ok';
    state['init_url'] = window.location.pathname;

    function getCookie(name) {
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length == 2) return parts.pop().split(";").shift();
    }

    function setCookie(name, value, timeoutSeconds) {
        var date = new Date();
        date.setTime(date.getTime() + timeoutSeconds * 1000);
        var expires = "; expires=" + date.toGMTString();
        document.cookie = name + "=" + value + expires + "; path=/";
    }

    function connect(init_handler) {
        if (window.MozWebSocket != undefined)
            window.WebSocket = window.MozWebSocket;
        if (window.WebSocket === undefined) {
            console.log('ax error: websockets support is missing in the browser');
            state['status'] = 'nowebsockets';
            return;
        }
        var prefix = state['secure'] ? 'wss://' : 'ws://';
        var path = prefix + state['host'] + ':' + window.location.port + '/__ws';
        if (ws) {
            ws.onclose = function () {};
            ws.close();
            ws = undefined;
        }
        ws = new WebSocket(path);
        ws.onmessage = function(e) {
            if (raw_handler) {
                if (raw_handler(e.data))
                    return;
            }
            try {
                var msg = JSON.parse(e.data);
                if (msg.type === '__ax_set_cookie') {
                    setCookie('__cid__', state['cid'], state['conn_timeout']);
                    return;
                }
                if (handlers[msg.type] != undefined)
                    handlers[msg.type](msg.data);
                else
                    console.log(
                        'Error: no handler for message "' + msg.type + '"')
            } catch (exn) {
                console.log('onmessage exception: ' + exn.message);
                if (error_handler)
                    error_handler('msgerr', JSON.stringify(exn))
            }
        };
        ws.onclose = function () {
            connected = false;
            if (disconnect_handler)
                disconnect_handler();
        };
        ws.onopen = function () {
            connected = true;
            if (init_handler)
                init_handler();
        };
        ws.onerror = function (e) {
            if (error_handler)
                error_handler('wserr', e);
        };
        return state;
    }

    return {
        getState: function() { return state; },
        connect: connect,
        isConnected: function () { return connected; },
        onError: function (handler) {
            error_handler = handler;
        },
        onDisconnect: function (handler) {
            disconnect_handler = handler;
        },
        on: function(msgtype, handler) {
            handlers[msgtype] = handler;
        },
        onRaw: function(handler) {
            raw_handler = handler;
        },
        send: function(msgtype, data) {
            ws.send(JSON.stringify({'type': msgtype, 'data': data}));
        }
    };

})();
