(function() {
  'use strict';

  var ip = require('ip');
  var Server = require('node-ssdp').Server;
  var config = require('./config');

  var server = new Server({
    location: 'http://' + ip.address() + ':' + config.get('service:port') + '/description',
    udn: config.get('service:udn')
  });

  server.addUSN('upnp:rootdevice');
  server.addUSN('urn:local-http-hub:1');

  server.on('advertise-alive', function(headers) {
    // Expire old devices from your cache.
    // Register advertising device somewhere (as designated in http headers heads)
  });

  server.on('advertise-bye', function(headers) {
    // Remove specified device from cache.
  });

  // start the server
  server.start();

  process.on('exit', function() {
    server.stop() // advertise shutting down and stop listening
  })

  /*  var Discovery = require('udp-discovery').Discovery;
    var config = require('./config');
    var log = require('./log')(module);

    var discover = new Discovery();

    var name = config.get('service:name');
    var interval = config.get('service:udpDiscoveryInterval');

    var serv = {
      port: config.get('service:port'),
      proto: 'tcp',
      addrFamily: 'IPv4'
    };

    discover.announce(name, serv, interval);

    discover.on('MessageBus', function(event, data) {
      log.debug('event:', event);
      log.debug('data:', data);
    });
    */
})();
