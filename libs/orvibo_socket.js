/*
 * Orvibo S20 Socket Module
 * -------------------------
 *
 * This library lets you control an Orvibo S20 Smart Socket from node.js
 * This code has been tested against Orvibo S20
 *
 * Usage
 * ------
 * You need to set your socket up using the WiWo app first. This code only controls an already set up socket
 * Require the s20_socket.js file, call discover of OrviboSocket, it'll return a promise for array of OrviboSocket instances
 * then call setState for needed instance
 */

var _ = require('underscore');
var when = require('when'); // library for promises
var udpInteraction = require('./udp_transport');
var twenties = ['0x20', '0x20', '0x20', '0x20', '0x20', '0x20']; // this appears at the end of a few packets we send, so put it here for shortness of code

var OrviboSocket = function(data) {
  this._data = data;
};

OrviboSocket.discover = function() {
  var result = {};

  return udpInteraction.activate()
    .then(function() {
      // listening to socket found event
      udpInteraction.on('socket_found', function(socket) {
        if (!result[socket.macaddress]) {
          result[socket.macaddress] = new OrviboSocket(socket);
        }
      });

      // this broadcast request make sockets to respond with their info
      var broadcastip = '255.255.255.255'; // Where we'll send our 'discovery' packet
      var payload = ['0x68', '0x64', '0x00', '0x06', '0x71', '0x61'];
      return udpInteraction.sendMessage(payload, broadcastip);
    })
    .then(function() {
      // method will resolve after 2 seconds with all found sockets
      var defer = when.defer();
      setTimeout(function() {
        defer.resolve(result);
        udpInteraction.removeAllListeners('socket_found');
      }, 2000);
      return defer.promise;
    })
    .then(function(sockets) {
      // we need to subscribe to each socket
      // and get it's name
      return when.map(sockets, function(socket, macAddress) {
          return socket.subscribe().then(socket.getName.bind(socket));
        })
        .then(function() {
          return sockets;
        });
    });
};

OrviboSocket.prototype.subscribe = function() {
  var defer = when.defer();
  var handler = this.socketSubscribedHandler.bind(this, defer);
  udpInteraction.on('socket_subscribed', handler);

  var macReversed = this.getReverseMacAddress();
  var payload = ['0x68', '0x64', '0x00', '0x1e', '0x63', '0x6c'].concat(hex2ba(this._data.macaddress), twenties, macReversed, twenties); // The subscription packet
  udpInteraction.sendMessage(payload, this._data.ipaddress);

  return defer.promise.then(function() {
    var defer = when.defer();
    udpInteraction.removeListener('socket_subscribed', handler);
    setTimeout(defer.resolve, 200);
    return defer.promise;
  });
};

OrviboSocket.prototype.getName = function() {
  if (!this._data.subscribed) {
    return this.subscribe().then(this.getName.bind(this));
  }

  var defer = when.defer();
  var handler = this.socketNameReceivedHandler.bind(this, defer);
  udpInteraction.on('socket_name_received', handler);

  // send request to get socket name
  var payload = ['0x68', '0x64', '0x00', '0x1d', '0x72', '0x74'].concat(hex2ba(this._data.macaddress), twenties, ['0x00', '0x00', '0x00', '0x00', '0x04', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00']);
  udpInteraction.sendMessage(payload, this._data.ipaddress);

  return defer.promise.then(function(result) {
    var defer = when.defer();
    udpInteraction.removeListener('socket_name_received', handler);
    setTimeout(defer.resolve, 200);
    return defer.promise;
  });
};

OrviboSocket.prototype.state = function() {
  return this._data.state;
};

OrviboSocket.prototype.name = function() {
  return this._data.name;
};

OrviboSocket.prototype.setState = function(state) {
  if (!this._data.subscribed) {
    return this.subscribe().then(this.getName.bind(this)).then(this.setState.bind(this, state));
  }

  var defer = when.defer();
  var handler = this.socketStateChangedHandler.bind(this, defer);
  udpInteraction.on('socket_state_changed', handler);

  // send request to set socket state
  var controlByte = state ? '0x01' : '0x00';
  var payload = ['0x68', '0x64', '0x00', '0x17', '0x64', '0x63'].concat([], hex2ba(this._data.macaddress), twenties, ['0x00', '0x00', '0x00', '0x00'], [controlByte]);
  udpInteraction.sendMessage(payload, this._data.ipaddress);

  return defer.promise.then(function(result) {
    var defer = when.defer();
    setTimeout(function() {
      udpInteraction.removeListener('socket_state_changed', handler);
      defer.resolve();
    }, 200);
    return defer.promise;
  });
};

OrviboSocket.prototype.socketSubscribedHandler = function(defer, macAddress, state) {
  // respond only to events for same macaddress
  if (macAddress === this._data.macaddress) {
    this._data.state = state;
    this._data.subscribed = true;
    defer.resolve();
  }
};

OrviboSocket.prototype.socketNameReceivedHandler = function(defer, macAddress, name) {
  // respond only to events for same macaddress
  if (macAddress === this._data.macaddress) {
    this._data.name = name;
    defer.resolve();
  }
};

OrviboSocket.prototype.socketStateChangedHandler = function(defer, macAddress, state) {
  // respond only to events for same macaddress
  if (macAddress === this._data.macaddress) {
    this._data.state = state;
    defer.resolve();
  }
};

OrviboSocket.prototype.getReverseMacAddress = function() {
  var macReversed = hex2ba(this._data.macaddress); // Convert our MAC address into a byte array (e.g. [0x12, 0x23] etc.)
  return macReversed.slice().reverse(); // And reverse the individual sections (e.g. ACCF becomes CFAC etc.)
}

function hex2ba(hex) { // Takes a string of hex and turns it into a byte array: ['0xAC', '0xCF] etc.
  arr = []; // New array
  for (var i = 0; i < hex.length; i += 2) { // Loop through our string, jumping by 2 each time
    arr.push('0x' + hex.substr(i, 2)); // Push 0x and the next two bytes onto the array
  }
  return arr;
}

function hex2a(hexx) { // Takes a hex string and turns it into an ASCII string
  var hex = hexx.toString(); //force conversion
  var str = '';
  for (var i = 0; i < hex.length; i += 2)
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return str;
}

module.exports = OrviboSocket; // And make every OrviboSocket function available to whatever file wishes to use it.
