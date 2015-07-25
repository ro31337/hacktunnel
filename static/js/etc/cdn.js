// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

var cdn = (function () {

    var prefix = '//' + window.location.hostname + ':3000/img/';

    var req_meta = [
    {
        background: 'drops.jpg',
        opts: { slogan_color: 'white' }
    },
    {
        background: 'mailbox.jpg',
        opts: { slogan_color: '#e0e0e0' }
    },
    {
        background: 'aurora.jpg',
        opts: { slogan_color: '#f0f0f0' }
    },
    {
        background: 'sky.jpg',
        opts: { slogan_color: '#f0f0f0' }
    },
    {
        background: 'mountains.jpg',
        opts: { slogan_color: '#ffffff' }
    }
    ];

    function getRequestTunnelViewMetadata() {
        var i = Math.floor(Math.random() * req_meta.length);
        return {
            background_url: prefix + 'index-page-backgrounds/' + req_meta[i].background,
            opts: req_meta[i].opts
        };
    }

    function getTalkViewMetadata() {
        var i = Math.floor((Math.random() * 14)) + 1 + '';
        return {background_url: prefix + 'tunnel-page-backgrounds/bg' + i + '.jpg'};
    }

    return {
        getRequestTunnelViewMetadata: getRequestTunnelViewMetadata,
        getTalkViewMetadata: getTalkViewMetadata
    };
})();
