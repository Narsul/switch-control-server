'use strict';

var _ = require('underscore');
var express = require('express');
var methodOverride = require('method-override');
var morgan = require('morgan');
var path = require('path'); // module for path parsing
var timeout = require('connect-timeout');

var config = require('./libs/config');
var ModbusSwitch = require('./libs/modbus_switch');
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
  ModbusSwitch.updateStates(switches)
    .then(function(switches) {
      res.json({
        method: 'devices',
        devices: getDevices(switches)
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
  var id = req.params.id;
  var switchObj = switches[id];

  if (!switchObj) {
    res.statusCode = 400;
    res.json({
      error: 'Switch with id ' + id + ' not found'
    });
    return;
  }

  res.json({
    method: 'switch',
    switch: {
      id: id,
      name: switchObj.name(),
      state: Boolean(switchObj.state())
    }
  });
});

app.put('/switch/:id/:state', function(req, res) {
  var id = req.params.id;
  var newState = req.params.state === 'on';
  var switchObj = switches[id];

  if (!switchObj) {
    res.statusCode = 400;
    res.json({
      error: 'Switch with id ' + id + ' not found'
    });
    return;
  }

  switchObj.setState(newState)
    .then(function() {
      res.json({
        method: 'switch',
        switch: {
          id: id,
          name: switchObj.name(),
          state: Boolean(switchObj.state())
        }
      })
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

var switches = ModbusSwitch.init(config.get('modbus:switches'));
var sockets = {};

OrviboSocket.discover().then(function(foundSockets) {
  sockets = foundSockets;
  log.info('Found ' + _.keys(sockets).length + ' sockets');

  log.info('Starting service "' + config.get('service:name') + '" on port ' + config.get('service:port') + ' ...');
  app.listen(config.get('service:port'));

  log.info('Starting UDP discovery for service...');
  require('./libs/discovery');
});

function getDevices(switches) {
  return {
    sockets: _.mapObject(sockets, function(socket, id) {
      return {
        name: socket.name(),
        state: socket.state(),
        id: id
      };
    }),
    switches: _.mapObject(switches, function(switchObj, id) {
      return {
        name: switchObj.name(),
        state: switchObj.state(),
        id: id
      };
    })
  };
}
