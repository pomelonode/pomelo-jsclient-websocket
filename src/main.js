if(typeof window === 'undefined') {
    global.window = {};
}

var Emitter = require('component-emitter');
window.EventEmitter = Emitter;

var protocol = require('pomelo-protocol');
window.Protocol = protocol;

var protobuf = require('pomelo-protobuf');
window.protobuf = protobuf;

var pomelo = require('../lib/pomelo-client');
window.pomelo = pomelo;

if (typeof module !== 'undefined') {
    module.exports = pomelo;
}