var when = require('when'); // library for promises
var util = require('util'); // For inheriting the EventEmitter stuff so we can use it via this.emit();
var EventEmitter = require('events').EventEmitter; // For emitting events so other node.js libraries and code can react to what we're doing here
var sDgram = require('dgram'); // this library gives us UDP support

var scktClient = sDgram.createSocket('udp4'); // For sending data
var scktServer = sDgram.createSocket('udp4'); // For receiving data

var addresses = getBroadcastAddress(); // Get our local IP address
if (!addresses.length) {
  throw new Error('Can\'t get local ip address');
}
var localIP = addresses[0]; // Get our local IP address
var broadcastip = '255.255.255.255'; // Where we'll send our 'discovery' packet

var port = 10000 // The port we'll connect on

util.inherits(UDPTransport, EventEmitter); // We want to get all the benefits of EventEmitter, but in our own class. this means we can use this.emit('Derp');

function UDPTransport(){
  EventEmitter.call(this); // Needed so we can emit() from this module
  scktServer.on('message', this._processReceivedMessage.bind(this));
};

UDPTransport.prototype.activate = function() {
  // setting handler to parse responses from sockets
  scktServer.on('message', this._processReceivedMessage.bind(this));

  var defer = when.defer();
  scktClient.bind(function() {
    scktClient.setBroadcast(true); // If we don't do this, we can't send broadcast packets to x.x.x.255, so we can never discover our sockets!
    defer.resolve();
  });

  scktServer.bind(port, localIP);
  return defer.promise;
};

UDPTransport.prototype.sendMessage = function(message, ipaddress) { // The fun (?) part of our module. Sending of the messages!
  var defer = when.defer();
  message = new Buffer(message); // We need to send as a buffer. this line takes our message and makes it into one.
  process.nextTick(function() { // Next time we're processing stuff. To keep our app from running away from us, I suppose
    scktClient.send(message, 0, message.length, port, ipaddress, function(err, bytes) { // Send the message. Parameter 2 is offset, so it's 0.
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve();
      }
    });
  });
  return defer.promise;
};

UDPTransport.prototype._processReceivedMessage = function(message, remote) { // We've got a message back from the network
  if (remote.address !== localIP) { //Check message isn't from us
    var messageHex = new Buffer(message).toString('hex'); // Convert our message into a string of hex
    var macAddress = messageHex.substr(messageHex.indexOf('accf'), 12); // Look for the first occurance of ACCF (the start of our MAC address) and grab it, plus the next 12 bytes
    var socketState;

    // console.log('---', messageHex, remote.address);

		switch (messageHex.substr(0, 12)) { // Look for the first twelve bytes
      case '6864002a7161': // We've asked for all sockets on the network, and smoeone has replied!
        socketState = messageHex.substr(messageHex.length - 1, 1) === '1' // last byte is a state
        var socket = {
          name: '', // The name of our socket. We don't know it yet!
          ipaddress: remote.address, // The IP address of our socket
          macaddress: macAddress, // And the MAC address
          subscribed: false, // We haven't subscribed to this socket yet
          state: socketState
        };
        this.emit('socket_found', socket); // Tell the world we've found a socket!
        break;

      case '686400dc7274': // We've queried the socket for the name, and we've got data coming back
        var strName = messageHex.split('202020202020')[4]; // We want everything after the fourth 202020202020 which is where our name starts
        strName = strName.substr(0, 32).toString('hex'); // And we want the next 32 bytes, as this is how long our name is. When we get it, trim the whitespace off.
        if (strName == 'ffffffffffffffffffffffffffffffff') { // When no name is set, we get lots of FFFF's back, so if we see that
          strName = 'Orvibo Socket ' + macAddress; // Set our name to something standard
        } else {
          strName = hex2a(strName.toString('hex')); // Turn our buffer into a hex string and then turn that into a string
          strName = strName.trim();
        }

        this.emit('socket_name_received', macAddress, strName); // We're done querying, so tell everyone. Include the name and macaddress for record keeping
        break;

      case '68640018636c': // We've asked to subscribe to a socket, and this is confirmation. It also includes the state of our socket (00 = off, 01 = on)
        socketState = messageHex.substr(messageHex.length - 1, 1) === '1'; // Pull out the state from our socket and set it in our array
        this.emit('socket_subscribed', macAddress, socketState); // Emit that we've subscribed, plus the macaddress of our socket, plus the current state
        break;

      case '686400177366': // Something has changed the state of our socket (e.g. pressing the button on the socket or the app)
        socketState = messageHex.substr(messageHex.length - 1, 1) === '1'; // Extract the state, same as always
        this.emit('socket_state_changed', macAddress, socketState); // Tell the world we've changed. Include our macadress and state
        break;
    }
    this.emit('message_received', message, remote.address); // It's not from us, so let everyone know we've got data
  }
}

function getBroadcastAddress() { // A bit of code that lets us get our network IP address
  var os = require('os')
  var interfaces = os.networkInterfaces(); // Get a list of interfaces
  var addresses = [];
  for (k in interfaces) { // Loop through our interfaces
    for (k2 in interfaces[k]) { // And our sub-interfaces
      var address = interfaces[k][k2]; // Get the address
      if (address.family == 'IPv4' && !address.internal) { // If we're IPv4 and it's not an internal address (like 127.0.0.1)
        addresses.push(address.address) // Shove it onto our addresses array
      }
    }
  }
  return addresses;
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

module.exports = new UDPTransport();
