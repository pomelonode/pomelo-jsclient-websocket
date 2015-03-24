#Pomelo javascript websocket client

The javascript websocket client library for [Pomelo](https://github.com/NetEase/pomelo).

Since there are two kind connectors in pomelo 0.3, socket.io and socket(websocket), we provide two javascript clients for different usage.
[websocket client](https://github.com/pomelonode/pomelo-jsclient-websocket) is optimized for data transfer size, the package is compressedin high rate. It's suitable for HTML5 online game, especially mobile platform.

[socket.io client](https://github.com/pomelonode/pomelo-jsclient-socket.io) is excellent for browser compatibility, the package is in json. It's suitable for online realtime application on browser, like chat, on which browser compatiblity is an important issue.

The apis are almost the same in both clients, except websocket client need a handshake callback for protocol data.
Both clients use [component](https://github.com/component/component/) package manager for building.

##Usage

### connect to the server
``` javascript
  pomelo.init(params, callback);
```  
params object are 

example:
``` javascript
  pomelo.init({
    host: host,
    port: port,
    user: {},
    handshakeCallback : function(){}
  }, function() {
    console.log('success');
  });
```

user field is user define json content  
handshakeCallback field is handshake callback function  

### send request to server with callback
``` javascript
  pomelo.request(route, msg, callback);
```

example:
``` javascript
	pomelo.request(route, {
		rid: rid
	}, function(data) {
    console.log(dta);	
	});
```

### send request to server without callback
``` javascript
  pomelo.notify(route, params);
```

### receive message from server 
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

### disconnect from server  
``` javascript
pomelo.disconnect();
```  

##License
(The MIT License)

Copyright (c) 2012-2015 NetEase, Inc. and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
