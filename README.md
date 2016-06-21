#Pomelo javascript websocket client

The javascript websocket client library for [Pomelo](https://github.com/NetEase/pomelo).

This pomelo client library is essentially identical to https://github.com/pomelonode/pomelo-jsclient-websocket, but some additional features to enable nodejs/browser compatibility and promises were added.

##Usage
### 1. nodejs/browser setup
- In order to setup this pomelo client with nodejs its necessary define a global.WebSocket, and WebSocket must follow the WebSockets API. Setup example:
``` javascript
global.WebSocket = require('ws'); // https://www.npmjs.com/package/ws
// or
global.WebSocket = require('websocket').w3cwebsocket; // https://www.npmjs.com/package/websocket

var pomeloClient = require('pomelo-jsclient-websocket');
``` 
- Include pomelo-wsclient.js file in browser environments is enough, as it defines window.pomeloClient.

### 2. connect to the server
``` javascript
  var pomelo = new pomeloClient();
  pomelo.init(params[, callback]); // returns a promise
```  
example:
``` javascript
  var pomelo = new pomeloClient();
  pomelo.init({
    host: host,
    port: port,
    user: {},
    handshakeCallback : function(){}
  }).then(function() {
    console.log('success');
  }).catch(function() {
    console.log('error');
  });
```

user field is user define json content  
handshakeCallback field is handshake callback function  

### 3. send request to server with callback
``` javascript
  pomelo.request(route[, msg, callback]) // returns a promise;
```

example:
``` javascript
  var pomelo = new pomeloClient();
  pomelo.init({
    host: host,
    port: port
  }).then(function() {
    return pomelo.request(route, {rid: rid});
  }).then(function(data) {
    console.log(dta);	
  });
```

### 4. send request to server without callback
``` javascript
  pomelo.notify(route, params);
```

### 5. receive message from server 
``` javascript
  pomelo.on(route, callback); 
```

example: 
``` javascript
	pomelo.on('onChat', function(data) {
		addMessage(data.from, data.target, data.msg);
		$("#chatHistory").show();
	});
```

### 6. disconnect from server  
``` javascript
pomelo.disconnect();
```  

##Build
1. Install all dependencies:
`npm install`

2. Generate the bundle:
`npm run build`

##License
(The MIT License)

Copyright (c) 2012-2015 NetEase, Inc. and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
