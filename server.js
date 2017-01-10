'use strict';

var _ = require('underscore');
var applescript = require('applescript');
var express = require('express');
var methodOverride = require('method-override');
var morgan = require('morgan');
var path = require('path'); // module for path parsing
var timeout = require('connect-timeout');
var when = require('when');
var whenNode = require('when/node');

var config = require('./libs/config');
var OrviboSocket = require('./libs/orvibo_socket');
var log = require('./libs/log')(module);
var app = express();
var execScript = whenNode.lift(applescript.execString);

app.use(timeout('10s'));
app.use(morgan('combined'));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(function(err, req, res, next) {
  res.status(500);
  res.render('error', {
    error: err
  });
});

app.get('/description', function(req, res) {
  res.json({
    method: 'description',
    name: config.get('service:name'),
    udn: config.get('service:udn')
  });
});

app.get('/devices', function(req, res) {
  res.json({
    method: 'devices',
    devices: getDevices()
  });
});

app.get('/socket/:id', function(req, res) {
  var id = req.params.id;
  var socket = sockets[id];

  if (!socket) {
    res.statusCode = 400;
    res.json({
      error: 'Socket with mac address ' + macaddress + ' not found'
    });
    return;
  }

  res.json({
    method: 'socket',
    socket: {
      id: id,
      name: socket.name(),
      state: socket.state()
    }
  });
});

app.put('/socket/:id/:state', function(req, res) {
  var id = req.params.id;
  var socket = sockets[id];

  if (!socket) {
    res.statusCode = 400;
    res.json({
      error: 'Socket with mac address ' + macaddress + ' not found'
    });
    return;
  }

  var newState = req.params.state === 'on';
  var dndPromise = execScript(`ignoring application responses
	tell application "System Events" to keystroke "d" using {command down, option down, control down}
end ignoring`)
  var setStatePromise = socket.setState(newState);

  when.join(dndPromise, setStatePromise)
    .then(function() {
      res.json({
        method: 'socket',
        socket: {
          id: id,
          name: socket.name(),
          state: socket.state()
        }
      });
    })
    .catch(function(error) {
      res.statusCode = 500;
      res.json({
        error: error.message
      });
    });
});

var sockets = {};

OrviboSocket.discover().then(function(foundSockets) {
  console.log('test');
  sockets = foundSockets;
  log.info('Found ' + _.keys(sockets).length + ' sockets');

  log.info('Starting service "' + config.get('service:name') + '" on port ' + config.get('service:port') + ' ...');
  app.listen(config.get('service:port'));

  log.info('Starting UDP discovery for service...');
  require('./libs/discovery');
});

function getDevices() {
  return {
    sockets: _.mapObject(sockets, function(socket, id) {
      return {
        name: socket.name(),
        state: socket.state(),
        id: id
      };
    })
  };
}
