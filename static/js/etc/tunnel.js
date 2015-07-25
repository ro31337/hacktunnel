// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

(function () {
'use strict';

function handleTunnelEvent(evtype, data) {
    if (this.evhandlers[evtype] === undefined) {
        console.log('event "' + evtype + '" is not handled');
    } else {
        (this.evhandlers[evtype])(data);
    }
}

// Simple tunnel (via HTTP server)
var SimpleTunnel = function (tunnel_id) {
    this.id = tunnel_id;
    this.evhandlers = {};
    ax.on('on_simple_recv', function (data) {
        (handleTunnelEvent.bind(this))('recv', data);
    }.bind(this));
    ax.on('on_simple_disconnect', function (data) {
        (handleTunnelEvent.bind(this))('disconnect', data);
    }.bind(this));
    ax.on('on_simple_error', function (data) {
        (handleTunnelEvent.bind(this))('error', data);
    }.bind(this));
};

SimpleTunnel.prototype.send = function (data) {
    ax.send('simple_send', {'id': this.id, 'data': data});
};

SimpleTunnel.prototype.disconnect = function (reason) {
    tunnel.leave(this.id, reason);
    //ax.send('simple_disconnect', {'id': this.id, 'reason': reason});
};

SimpleTunnel.prototype.on = function (evtype, handler) {
    this.evhandlers[evtype] = handler;
};

window.SimpleTunnel = SimpleTunnel;
})();


var tunnel = (function () {
'use strict';

var requests = {};

function request(tunnel_name) {
    var unknown_name = (tunnel_name === undefined);
    var fn;
    ax.on('on_request_tunnel', function (data) {
        if (unknown_name) {
            fn(data);
        } else {
            fn = requests[data['name']];
            if (fn)
                fn(data);
        }
    });
    return new Promise(function (resolve) {
        if (unknown_name) {
            fn = function (data) {
                resolve(data);
            };
        } else {
            requests[tunnel_name] = function (data) {
                if (data['name'] == tunnel_name) {
                    // remove entry from requests to be GC-ed
                    requests[tunnel_name] = undefined;
                    resolve(data);
                }
            }
        }
        ax.send('request_tunnel', {'name': tunnel_name});
    });
}

var namesets = {};

lib.setHandler('on_set_tunnel_name', namesets, 'id');

function setName(owner_id, tunnel_id, tunnel_name) {
    return lib.doAsync(namesets, 'id', tunnel_id,
                       'set_tunnel_name', {
                                    'owner_id': owner_id,
                                    'id': tunnel_id,
                                    'name': tunnel_name
                                    }
                        );
}

var enters = {};

lib.setHandler('on_enter_tunnel', enters, 'id');

// Enter the tunnel.
function enter(tunnel_id, has_pass) {
    return new Promise(function (resolve) {
        var flags = 0;
        if (has_pass)
            flags |= 1;
        lib.doAsync(enters, 'id', tunnel_id,
                'enter_tunnel', {'id': tunnel_id, 'flags': flags})
        .then(function (data) { // 'on_enter_tunnel'
            resolve(data);
        });
    });
}

var leaves = {};

lib.setHandler('on_leave_tunnel', leaves, 'id');

// Leave the tunnel.
function leave(tunnel_id, reason) {
    return lib.doAsync(leaves, 'id', tunnel_id,
                   'leave_tunnel', {'id': tunnel_id, 'reason': reason});
}

return {
    request: request,
    enter: enter,
    leave: leave,
    setName: setName
};

})();
