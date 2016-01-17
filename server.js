'use strict';

var _ = require('underscore');
var express = require('express');
var methodOverride = require('method-override');
var morgan = require('morgan');
var path = require('path'); // module for path parsing

var config = require('./libs/config');
var modbusQueue = require('./libs/modbus_queue');
var OrviboSocket = require('./libs/orvibo_socket');
var log = require('./libs/log')(module);
var app = express();

process.on('uncaughtException', function(err) {
  console.log(err);
});

app.use(morgan('combined'));
app.use(methodOverride('X-HTTP-Method-Override'));

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

app.get('/switch', function(req, res) {
  modbusQueue.switchLight(req.query.name, req.query.state === 'on')
    .then(modbusQueue.getSwitchStates.bind(modbusQueue))
    .then(function(switchStates) {
      res.json({
        method: 'switch',
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

app.get('/socket', function(req, res) {
  var macaddress = req.query.macaddress;
  var socket = sockets[macaddress];

  if (!socket) {
    res.statusCode = 400;
    res.json({
      error: 'Socket with mac address ' + macaddress + ' not found'
    });
    return;
  }

  var state = req.query.state === 'on';
  socket.setState(state)
    .then(modbusQueue.getSwitchStates.bind(modbusQueue))
    .then(function(switchStates) {
      res.json({
        method: 'socket',
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

var sockets = {};
OrviboSocket.discover().then(function(foundSockets) {
  sockets = foundSockets;
  log.info('Found ' + _.keys(sockets).length + ' sockets');

  log.info('Starting server on port ' + config.get('service:port') + ' ...');
  app.listen(config.get('service:port'));

  log.info('Starting UDP discovery for service...');
  require('./libs/discovery');
});

function getDevices(switchStates) {
  return {
    sockets: _.map(sockets, function(socket, macAddress) {
      return {
        name: socket.name(),
        state: socket.state(),
        id: macAddress
      };
    }),
    switches: _.map(switchStates, function(switchObj, switchName) {
      return {
        name: switchObj.label,
        state: switchObj.state,
        id: switchName
      };
    })
  };
}
