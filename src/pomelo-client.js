(function () {
  var root = typeof(window) !== 'undefined' ? window : global;

  var JS_WS_CLIENT_TYPE = 'js-websocket';
  var JS_WS_CLIENT_VERSION = '0.0.1';

  var Protocol = require('pomelo-protocol');
  var protobuf = require('pomelo-protobuf');
  var decodeIO_protobuf = root.decodeIO_protobuf;
  var decodeIO_encoder = null;
  var decodeIO_decoder = null;
  var Package = Protocol.Package;
  var Message = Protocol.Message;
  var EventEmitter = require('component-emitter');
  var rsa = rsa = root.rsa;
  var q = require('q');
  var WebSocket = root.WebSocket;

  if(typeof (sys) != 'undefined' && sys.localStorage) {
    root.localStorage = sys.localStorage;
  }

  var RES_OK = 200;
  var RES_FAIL = 500;
  var RES_OLD_CLIENT = 501;

  if (typeof Object.create !== 'function') {
    Object.create = function (o) {
      function F() { }
      F.prototype = o;
      return new F();
    };
  }

  var pomeloClient = function () {
    EventEmitter.call(this);
    this.socket = null;
    this.reqId = 0;
    this.callbacks = {};
    this.handlers = {};
    this.handlers[Package.TYPE_HANDSHAKE] = this.handshake.bind(this);
    this.handlers[Package.TYPE_HEARTBEAT] = this.heartbeat.bind(this);
    this.handlers[Package.TYPE_DATA] = this.onData.bind(this);
    this.handlers[Package.TYPE_KICK] = this.onKick.bind(this);
    //Map from request id to route
    this.routeMap = {};
    this.dict = {};    // route string to code
    this.abbrs = {};   // code to route string
    this.serverProtos = {};
    this.clientProtos = {};
    this.protoVersion = 0;

    this.heartbeatInterval = 0;
    this.heartbeatTimeout = 0;
    this.nextHeartbeatTimeout = 0;
    this.gapThreshold = 100;   // heartbeat gap threashold
    this.heartbeatId = null;
    this.heartbeatTimeoutId = null;
    this.handshakeCallback = null;

    this.reconnect = false;
    this.reconncetTimer = null;
    this.reconnectUrl = null;
    this.reconnectAttempts = 0;
    this.reconnectionDelay = 5000;
    this.DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

    this.useCrypto;

    this.handshakeBuffer = {
      'sys': {
        type: JS_WS_CLIENT_TYPE,
        version: JS_WS_CLIENT_VERSION,
        rsa: {}
      },
      'user': {
      }
    };

    this.initDeferred = null;
  };
  // inherit EventEmitter prototype
  pomeloClient.prototype = Object.create(EventEmitter.prototype);
  // correct the constructor pointer because it points to Person
  pomeloClient.prototype.constructor = pomeloClient;

  pomeloClient.prototype.init = function (params, cb) {
    this.initDeferred = q.defer();
    var host = params.host;
    var port = params.port;

    this.encode = params.encode || this.encode;
    this.decode = params.decode || this.decode;

    var url = 'ws://' + host;
    if (port) {
      url += ':' + port;
    }

    this.handshakeBuffer.user = params.user;
    if (params.encrypt) {
      this.useCrypto = true;
      rsa.generate(1024, "10001");
      var data = {
        rsa_n: rsa.n.toString(16),
        rsa_e: rsa.e
      };
      this.handshakeBuffer.sys.rsa = data;
    }
    this.handshakeCallback = params.handshakeCallback;
    this.connect(params, url);
    this.initDeferred.promise.done(cb || function() {}); // old api compatibility
    return this.initDeferred.promise;
  };

  pomeloClient.prototype.decode = function (data) {
    //probuff decode
    var msg = Message.decode(data);

    if (msg.id > 0) {
      msg.route = this.routeMap[msg.id];
      delete this.routeMap[msg.id];
      if (!msg.route) {
        return;
      }
    }

    msg.body = this.deCompose(msg);
    return msg;
  };

  pomeloClient.prototype.encode = function (reqId, route, msg) {
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;

    //compress message by protobuf
    if (protobuf && this.clientProtos[route]) {
      msg = protobuf.encode(route, msg);
    } else if (decodeIO_encoder && decodeIO_encoder.lookup(route)) {
      var Builder = decodeIO_encoder.build(route);
      msg = new Builder(msg).encodeNB();
    } else {
      msg = Protocol.strencode(JSON.stringify(msg));
    }

    var compressRoute = 0;
    if (this.dict && this.dict[route]) {
      route = this.dict[route];
      compressRoute = 1;
    }

    return Message.encode(reqId, type, compressRoute, route, msg);
  };

  pomeloClient.prototype.connect = function (params, url) {
    var params = params || {};
    var maxReconnectAttempts = params.maxReconnectAttempts || this.DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.reconnectUrl = url;
    //Add protobuf version
    if (root.localStorage && root.localStorage.getItem('protos') && this.protoVersion === 0) {
      var protos = JSON.parse(root.localStorage.getItem('protos'));

      this.protoVersion = protos.version || 0;
      this.serverProtos = protos.server || {};
      this.clientProtos = protos.client || {};

      if (!!protobuf) {
        protobuf.init({ encoderProtos: this.clientProtos, decoderProtos: this.serverProtos });
      }
      if (!!decodeIO_protobuf) {
        decodeIO_encoder = decodeIO_protobuf.loadJson(this.clientProtos);
        decodeIO_decoder = decodeIO_protobuf.loadJson(this.serverProtos);
      }
    }
    //Set protoversion
    this.handshakeBuffer.sys.protoVersion = this.protoVersion;

    var onopen = function (event) {
      if (!!this.reconnect) {
        this.emit('reconnect');
      }
      this.reset();
      var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(this.handshakeBuffer)));
      this.send(obj);
    };
    var onmessage = function (event) {
      this.processPackage(Package.decode(event.data));
      // new package arrived, update the heartbeat timeout
      if (this.heartbeatTimeout) {
        this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
      }
    };
    var onerror = function (event) {
      this.emit('io-error', event);
      this.initDeferred.reject(event);
    };
    var onclose = function (event) {
      this.emit('close', event);
      this.emit('disconnect', event);
      if (!!params.reconnect && this.reconnectAttempts < maxReconnectAttempts) {
        this.reconnect = true;
        this.reconnectAttempts++;
        this.reconncetTimer = setTimeout(function () {
          this.connect(params, this.reconnectUrl);
        }.bind(this), this.reconnectionDelay);
        this.reconnectionDelay *= 2;
      }
    };
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = onopen.bind(this);
    this.socket.onmessage = onmessage.bind(this);
    this.socket.onerror = onerror.bind(this);
    this.socket.onclose = onclose.bind(this);
  };

  pomeloClient.prototype.disconnect = function () {
    if (this.socket) {
      if (this.socket.disconnect) this.socket.disconnect();
      if (this.socket.close) this.socket.close();
      this.emit('disconnect');
      this.socket = null;
    }

    if (this.heartbeatId) {
      clearTimeout(this.heartbeatId);
      this.heartbeatId = null;
    }
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  };

  pomeloClient.prototype.reset = function () {
    this.reconnect = false;
    this.reconnectionDelay = 1000 * 5;
    this.reconnectAttempts = 0;
    clearTimeout(this.reconncetTimer);
  };

  pomeloClient.prototype.request = function (route, msg, cb) {
    var deferred = q.defer();
    if (arguments.length === 2 && typeof msg === 'function') {
      cb = qWrap(msg, deferred);
      msg = {};
    } else if(!cb) { 
      cb = deferred.resolve;
    }
    msg = msg || {};
    route = route || msg.route;
    if (!route) {
      return;
    }

    this.reqId++;
    this.sendMessage(this.reqId, route, msg);

    this.callbacks[this.reqId] = cb;
    this.routeMap[this.reqId] = route;
    return deferred.promise;
  };

  pomeloClient.prototype.notify = function (route, msg) {
    msg = msg || {};
    this.sendMessage(0, route, msg);
  };

  pomeloClient.prototype.sendMessage = function (reqId, route, msg) {
    if (this.useCrypto) {
      msg = JSON.stringify(msg);
      var sig = rsa.signString(msg, "sha256");
      msg = JSON.parse(msg);
      msg['__crypto__'] = sig;
    }

    if (this.encode) {
      msg = this.encode(reqId, route, msg);
    }

    var packet = Package.encode(Package.TYPE_DATA, msg);
    this.send(packet);
  };

  pomeloClient.prototype.send = function (packet) {
    if (this.socket && this.socket.readyState === this.socket.OPEN)
      this.socket.send(packet.buffer);
  };

  pomeloClient.prototype.heartbeat = function (data) {
    if (!this.heartbeatInterval) {
      // no heartbeat
      return;
    }

    var obj = Package.encode(Package.TYPE_HEARTBEAT);
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }

    if (this.heartbeatId) {
      // already in a heartbeat interval
      return;
    }
    this.heartbeatId = setTimeout(function () {
      this.heartbeatId = null;
      this.send(obj);

      this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
      this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb.bind(this), this.heartbeatTimeout);
    }.bind(this), this.heartbeatInterval);
  };

  pomeloClient.prototype.heartbeatTimeoutCb = function () {
    var gap = this.nextHeartbeatTimeout - Date.now();
    if (gap > this.gapThreshold) {
      this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb.bind(this), gap);
    } else {
      this.emit('error', 'heartbeat timeout');
      this.disconnect();
    }
  };

  pomeloClient.prototype.handshake = function (data) {
    data = JSON.parse(Protocol.strdecode(data));
    if (data.code === RES_OLD_CLIENT) {
      this.emit('error', 'client version not fullfill');
      return;
    }

    if (data.code !== RES_OK) {
      this.emit('error', 'handshake fail');
      return;
    }

    this.handshakeInit(data);

    var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
    this.send(obj);
    this.initDeferred.resolve(data);
  };

  pomeloClient.prototype.onData = function (data) {
    var msg = data;
    if (this.decode) {
      msg = this.decode(msg);
    }
    this.processMessage(msg);
  };

  pomeloClient.prototype.onKick = function (data) {
    data = JSON.parse(Protocol.strdecode(data));
    this.emit('onKick', data);
  };

  pomeloClient.prototype.processPackage = function (msgs) {
    if (Array.isArray(msgs)) {
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        this.handlers[msg.type](msg.body);
      }
    } else {
      this.handlers[msgs.type](msgs.body);
    }
  };

  pomeloClient.prototype.processMessage = function (msg) {
    if (!msg.id) {
      // server push message
      this.emit(msg.route, msg.body);
      return;
    }

    //if have a id then find the callback function with the request
    var cb = this.callbacks[msg.id];

    delete this.callbacks[msg.id];
    if (typeof cb !== 'function') {
      return;
    }

    cb(msg.body);
    return;
  };

  pomeloClient.prototype.deCompose = function (msg) {
    var route = msg.route;

    //Decompose route from dict
    if (msg.compressRoute) {
      if (!this.abbrs[route]) {
        return {};
      }

      route = msg.route = this.abbrs[route];
    }
    if (protobuf && this.serverProtos[route]) {
      return protobuf.decodeStr(route, msg.body);
    } else if (decodeIO_decoder && decodeIO_decoder.lookup(route)) {
      return decodeIO_decoder.build(route).decode(msg.body);
    } else {
      return JSON.parse(Protocol.strdecode(msg.body));
    }
  };

  pomeloClient.prototype.handshakeInit = function (data) {
    if (data.sys && data.sys.heartbeat) {
      this.heartbeatInterval = data.sys.heartbeat * 1000;   // heartbeat interval
      this.heartbeatTimeout = this.heartbeatInterval * 2;        // max heartbeat timeout
    } else {
      this.heartbeatInterval = 0;
      this.heartbeatTimeout = 0;
    }

    this.initData(data);

    if (typeof this.handshakeCallback === 'function') {
      this.handshakeCallback(data.user);
    }
  };

  // Initilize data used in pomelo client
  pomeloClient.prototype.initData = function (data) {
    if (!data || !data.sys) {
      return;
    }
    this.dict = data.sys.dict;
    var protos = data.sys.protos;

    //Init compress dict
    if (this.dict) {
      this.dict = dict;
      this.abbrs = {};

      for (var route in this.dict) {
        this.abbrs[this.dict[route]] = route;
      }
    }

    //Init protobuf protos
    if (this.protos) {
      this.protoVersion = protos.version || 0;
      this.serverProtos = protos.server || {};
      this.clientProtos = protos.client || {};

      //Save protobuf protos to localStorage
      root.localStorage.setItem('protos', JSON.stringify(this.protos));

      if (!!protobuf) {
        protobuf.init({ encoderProtos: this.protos.client, decoderProtos: this.protos.server });
      }
      if (!!decodeIO_protobuf) {
        decodeIO_encoder = decodeIO_protobuf.loadJson(this.clientProtos);
        decodeIO_decoder = decodeIO_protobuf.loadJson(this.serverProtos);
      }
    }
  };

  function qWrap(callback, deferred) {
    callback = callback || function() {};
    return function() {
      var args = Array.prototype.slice.call(arguments);
      callback.apply(null, args);
      deferred.resolve.apply(deferred, args);
    };
  }

  module.exports = pomeloClient;
})();
