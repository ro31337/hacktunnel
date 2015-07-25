// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

var ee = new EventEmitter();

var core = (function () {

'use strict';

var dsakey;
var onkeyready;
var otr; // OTR instance
var tpass = '';
var tunnel_id;
var t; // tunnel transport instance

function newOtr(tunnel_id) {
    var p = '/static/vendor/otr/';
    var imports = [
          p + 'build/dep/salsa20.js'
        , p + 'build/dep/bigint.js'
        , p + 'build/dep/crypto.js'
        , p + 'build/dep/eventemitter.js'
        , p + 'lib/const.js'
        , p + 'lib/helpers.js'
        , p + 'lib/sm.js'
    ];
    var otr = new OTR({
        priv: dsakey,
        imports: imports,
        debug: false
    });
    otr.ALLOW_V2 = false;
    otr.ALLOW_V3 = true;
    return otr;
}

function getOtr(tunnel_id) {
    if (!otr)
        otr = newOtr(tunnel_id);
    return otr;
}

function destroyOtr(tunnel_id) {
    otr = undefined;
}

function getTunnel(tunnel_id) {
    return t;
}

function onOtrEnd(tunnel_id) {
    t.disconnect(0);
    t = undefined;
}

// Process incoming decrypted message
function onOtrIncomingDecrypted(tunnel_id, msg, encrypted) {
    if (!encrypted) {
        console.log('Error: message is not encrypted: ' + msg);
        return;
    }
    var m;
    try {
        m = JSON.parse(msg);
    } catch (e) {
        console.log('onOtrIncomingDecrypted error: ' + JSON.stringify(e));
        return;
    }
    switch (m['type']) {
    case 'text':
        ee.emit('!otr_text', {text: m['data']['text']});
        break;
    case 'bootstrap':
        break; // Bootstrap SMP message. Do nothing
    }
}

// Put encrypted message on the wire
function onOtrOutgoingEncrypted(tunnel_id, enc_msg, meta) {
    console.log('send:' + JSON.stringify(enc_msg));
    var t = getTunnel(tunnel_id);
    if (t)
        t.send(enc_msg);
    else
        console.log('onOtrOutgoingEncrypted error: no tunnel for ' + tunnel_id);
}

function onOtrStatus(tunnel_id, init_converation, status) {
    switch (status) {
    case OTR.CONST.STATUS_AKE_SUCCESS:
        if (init_converation) {
            var otr = getOtr(tunnel_id);
            if (!otr) {
                console.log('onOtrStatus STATUS_AKE_SUCCESS error: no OTR');
                break;
            }
            // The initiating side provides tunnel pass and expects
            // the same from the other side
            otr.smpSecret('#' + tpass);
        }
        break;
    case OTR.CONST.STATUS_END_OTR:
        onOtrEnd(tunnel_id);
        break;
    }
}

function onOtrSmp(tunnel_id, init_converation, type, data, act) {
    switch (type) {
    case 'question':
        if (init_converation) {
            console.log('onOtrSmp error: init, got question');
        } else {
            var otr = getOtr(tunnel_id);
            if (otr) {
                otr.smpSecret('#' + tpass);
            } else {
                console.log('onOtrSmp question: no OTR ' + tunnel_id);
            }
        }
        break;
    case 'trust':
        if (!data)
            console.log('trust: mismatch');
        ee.emit('!otr_trust', {
                                trusted: data,
                                init_converation: init_converation,
                                tunnel_id: tunnel_id
                            });
        if (!init_converation) {
            var otr = getOtr(tunnel_id);
            // Send bootstrap empty message.
            // This is needed to invoke 'trust' handler on the other side
            otrSend(otr, 'bootstrap', {});
            // Close tunnel (with sending 'leave_tunnel') if passphrase does not match
            if (!data)
                closeTunnel(tunnel_id);
        }
        break;
    case 'abort':
        console.log('OTR SMP abort:' + data);
        break;
    }
}

function otrSend(otr, msgtype, data) {
    otr.sendMsg(JSON.stringify({'type': msgtype, 'data': data}));
}

function setupOtr(otr, tunnel_id, init_converation) {
    otr.on('ui', onOtrIncomingDecrypted.bind(null, tunnel_id));
    otr.on('io', onOtrOutgoingEncrypted.bind(null, tunnel_id));
    otr.on('status', onOtrStatus.bind(null, tunnel_id, init_converation));
    otr.on('smp', onOtrSmp.bind(null, tunnel_id, init_converation));
    if (init_converation) {
        otr.sendQueryMsg(); // initiate OTR handshake
    }
}

function onSimpleRecv(data) {
    console.log('recv:' + JSON.stringify(data['data']));
    var tunnel_id = data['id'];
    var otr = getOtr(tunnel_id);
    if (otr) {
        var enc_msg = data['data'];
        otr.receiveMsg(enc_msg);
    } else {
        console.log('onSimpleRecv error: no OTR ' + tunnel_id);
    }
}

function onSimpleError(data) {
    console.log('onSimpleError: ' + JSON.stringify(data));
}

function onSimpleDisconnect(tunnel_id, data) {
    ee.emit('!remote_disconnect', {});
    destroyOtr(tunnel_id);
}

function onSimpleInit(data) {
    console.log('onSimpleInit FIXME initiate OTR SMP: ' + JSON.stringify(data));
    var tunnel_id = data['id'];
    t = new SimpleTunnel(tunnel_id); // TODO support multiple tunnels
    t.on('recv', onSimpleRecv); // NOTE .bind(...) is not applicable here
    t.on('error', onSimpleError);
    t.on('disconnect', onSimpleDisconnect.bind(null, tunnel_id));
    var otr = getOtr(tunnel_id);
    setupOtr(otr, tunnel_id, data['otr_init']);
}

function generateOTRKeyAsync() {
    return new Promise(function (resolve, reject) {
        DSA.createInWebWorker({path: '/static/js/etc/dsa-webworker.js'}, function (key) {
            console.log('DSA key has been generated');
            resolve(key);
        });
    });
}

generateOTRKeyAsync().then(function(key) {
    dsakey = key;
    if (onkeyready)
        onkeyready();
});

// Asynchonous OTR DSA key generation for self
function getOtrKeyAsync() {
    return new Promise(function (resolve, reject) {
        if (dsakey) {
            resolve(dsakey);
        } else {
            onkeyready = function () {
                resolve(dsakey);
            }
        }
    });
}

function onAxError(type, data) {
    console.log('ax error: ' + type + '; ' + JSON.stringify(data));
}

function onAxDisconnect() {
    console.log('Server disconnect');
    ee.emit('!disconnect');
}

function doQueryTunnel(tunnel_id, resolve) {
    ax.on('on_query_tunnel', function (data) {
        ax.on('on_query_tunnel');
        resolve(data);
    });
    ax.send('query_tunnel', {'id': tunnel_id});
}

function queryTunnel(tunnel_id) {
    return new Promise(function (resolve, reject) {
        if (!ax.isConnected()) {
            ax.onError(onAxError);
            ax.onDisconnect(onAxDisconnect);
            ax.connect(function () { doQueryTunnel(tunnel_id, resolve); });
        } else {
            doQueryTunnel(tunnel_id, resolve);
        }
    });
}

function enterTunnelPass(pass, tunnel_id) {
    return new Promise(function (resolve, reject) {
        tpass = pass;
        ax.on('on_simple_init', onSimpleInit);
        getOtrKeyAsync().then(function (key) {
            getOtr(tunnel_id);
            tunnel.enter(tunnel_id, pass !== '').then(function (data) {
                resolve({status: data['status'], created: data['created']});
            });
        });
    });
}

function enterMessage(tunnel_id, text) {
    var otr = getOtr(tunnel_id);
    if (!otr) {
        console.log('send_msg error: no OTR ' + tunnel_id);
        return;
    }
    otrSend(otr, 'text', {'text': text});
}

function closeTunnel(tunnel_id) {
    var t = getTunnel(tunnel_id);
    if (t)
        t.disconnect(1);
    else
        tunnel.leave(tunnel_id, 2);
    destroyOtr(tunnel_id);
}

return {
    queryTunnel: queryTunnel,
    enterTunnelPass: enterTunnelPass,
    enterMessage: enterMessage,
    closeTunnel: closeTunnel
};

})();
