;(function (root) {
  'use strict';

  root.OTR = {};
  root.DSA = {};
  if (!root.crypto)
    root.crypto = {};
  root.crypto.randomBytes = function () {
      throw new Error("Haven't seeded yet.");
  };

  // default imports
  var p = '/static/vendor/otr/build/';
  var imports = [
      p + 'dep/salsa20.js'
    , p + 'dep/bigint.js'
    , p + 'dep/crypto.js'
    , p + 'dep/eventemitter.js'
    , p + 'otr.js'
  ];

  function sendMsg(type, val) {
    postMessage({ type: type, val: val })
  }

  onmessage = function (e) {
    var data = e.data;

    if (data.imports)
      imports = data.imports;
    importScripts.apply(root, imports);

    // use salsa20 since there's no prng in webworkers
    var state = new root.Salsa20(data.seed.slice(0, 32), data.seed.slice(32));
    root.crypto.randomBytes = function (n) {
      return state.getBytes(n);
    };

    if (data.debug)
      sendMsg('debug', 'DSA key creation started');
    var dsa;
    try {
      dsa = new root.DSA();
    } catch (e) {
      if (data.debug)
        sendMsg('debug', e.toString());
      return;
    }
    if (data.debug)
      sendMsg('debug', 'DSA key creation finished');

    sendMsg('data', dsa.packPrivate());
  };

}(this));
