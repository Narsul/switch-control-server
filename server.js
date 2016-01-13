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

app.use(morgan('combined'));
app.use(methodOverride('X-HTTP-Method-Override'));

app.get('/switches', function(req, res) {
  modbusQueue.getSwitchStates()
    .then(function(states) {
      log.info(states);
      res.json(states);
    })
    .catch(function(error) {
      res.statusCode = 500;
      res.json({
        error: error.message
      });
    });
});

app.get('/switch-all-off', function(req, res) {
  modbusQueue.switchAllLightOff()
    .then(modbusQueue.getSwitchStates.bind(modbusQueue))
    .then(function(states) {
      log.info(states);
      res.json(states);
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
    .then(function(states) {
      log.info(states);
      res.json(states);
    })
    .catch(function(error) {
      res.statusCode = 500;
      res.json({
        error: error.message
      });
    });
});

app.get('/sockets', function(req, res) {
  var socketStates = getSocketStates();

  log.info(socketStates);
  res.json(socketStates);
});

app.get('/socket', function(req, res) {
  var macaddress = req.query.macaddress;
  var socket = sockets[macaddress];

  if (!socket) {
    res.statusCode = 400;
    res.json({error: 'Socket with mac address ' + macaddress + ' not found'});
    return;
  }

  var state = req.query.state === 'on';
  socket.setState(state)
    .then(function(){
      log.info(getSocketStates());
      res.json({state: state});
    })
    .catch(function(error) {
      res.statusCode = 500;
      res.json({
        error: error.message
      });
    });
});

var sockets = {};
OrviboSocket.discover().then(function(foundSockets){
  sockets = foundSockets;
  log.info('Found ' + _.keys(sockets).length + ' sockets');

  log.info('Starting server on port ' + config.get('port') + ' ...');
  app.listen(config.get('port'));
});

function getSocketStates() {
  return _.reduce(sockets, function(memo, socket, macaddress){
    memo[macaddress] = socket.getState();
    return memo;
  }, {});
}
