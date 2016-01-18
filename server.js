'use strict';

var _ = require('underscore');
var express = require('express');
var methodOverride = require('method-override');
var morgan = require('morgan');
var path = require('path'); // module for path parsing
var timeout = require('connect-timeout');

var config = require('./libs/config');
var modbusQueue = require('./libs/modbus_queue');
var OrviboSocket = require('./libs/orvibo_socket');
var log = require('./libs/log')(module);
var app = express();

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
  modbusQueue.getSwitchStates()
    .then(function(switchStates) {
      res.json({
        method: 'devices',
        devices: getDevices(switchStates)
      });
    })
    .catch(function(error) {
      res.statusCode = 500;
      res.json({
        error: error.message
      });
    });
});

app.get('/switch/:id', function(req, res) {
  modbusQueue.getSwitchStates()
    .then(function(switchStates) {
      var switchObj = switchStates[req.params.id];
      res.json({
        method: 'switch',
        switch: {
          id: req.params.id,
          name: switchObj.label,
          state: Boolean(switchObj.state)
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

app.put('/switch/:id/:state', function(req, res) {
  var newState = req.params.state === 'on';
  modbusQueue.switchLight(req.params.id, newState)
    .then(modbusQueue.getSwitchStates.bind(modbusQueue))
    .then(function(switchStates) {
      var switchObj = switchStates[req.params.id];
      res.json({
        method: 'switch',
        switch: {
          id: req.params.id,
          name: switchObj.label,
          state: Boolean(switchObj.state)
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
  socket.setState(newState)
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
  sockets = foundSockets;
  log.info('Found ' + _.keys(sockets).length + ' sockets');

  log.info('Starting service "' + config.get('service:name') + '" on port ' + config.get('service:port') + ' ...');
  app.listen(config.get('service:port'));

  log.info('Starting UDP discovery for service...');
  require('./libs/discovery');
});

function getDevices(switchStates) {
  return {
    sockets: _.mapObject(sockets, function(socket, macAddress) {
      return {
        name: socket.name(),
        state: socket.state(),
        id: macAddress
      };
    }),
    switches: _.mapObject(switchStates, function(switchObj, switchName) {
      return {
        name: switchObj.label,
        state: switchObj.state,
        id: switchName
      };
    })
  };
}
