module.exports = ModbusSwitch;

var _ = require('underscore');
var jsModbus = require('jsmodbus');
var when = require('when');

var config = require('./config');
var log = require('./log')(module);

function ModbusSwitch(params) {
  this._data = params;
  this._state = null;
}

ModbusSwitch.init = function(switchParamsList) {
  return _.reduce(switchParamsList, function(memo, switchParams){
    memo[switchParams.id] = new ModbusSwitch(switchParams);
    return memo;
  }, {})
};

ModbusSwitch.updateStates = function(switchList) {
  return createModbusClient()
    .then(function(client){
      return when(client.readDiscreteInput(1, 19))
        .then(function(resp){
          client.close();

          var states = _.isObject(resp) && _.isArray(resp.coils) ? resp.coils : [];
          _.each(switchList, function(switchObj){
            var state = states[switchObj._data.index]

            if (_.isBoolean(state)) {
              switchObj._state = state;
            } else {
              console.warn('No state available for switch: ' + switchObj._data.id);
            }
          });

          return switchList;
        });
    });
};

ModbusSwitch.prototype.state = function() {
  return this._state;
};

ModbusSwitch.prototype.name = function() {
  return this._data.label;
};

ModbusSwitch.prototype.setState = function(newState) {
  var addressType = newState ? 'on' : 'off';
  var address = this._data[addressType];

  return createModbusClient()
    .then(function(client){
      return when(client.writeSingleCoil(address, true))
        .then(wait(config.get('modbus:delayBetweenSignals')))
        .then(function(){
          return when(client.writeSingleCoil(address, false));
        })
        .then(wait(config.get('modbus:delayBetweenSignals')))
        .then(function(){
          return when(client.readDiscreteInput(1, 19));
        })
        .then(function(resp){
          var states = _.isObject(resp) && _.isArray(resp.coils) ? resp.coils : [];
          var state = states[this._data.index];

          if (_.isBoolean(state)) {
            this._state = state;
            if (state !== newState) {
              console.warn('Switch ' + this._data.id + ' didn\'t change state');
            }
          }
        }.bind(this))
        .then(function(){
          client.close();
        });
    }.bind(this));
};

var createModbusClient = function() {
  var defer = when.defer();
  var client = jsModbus.createTCPClient(config.get('modbus:port'), config.get('modbus:host'));
  client.on('connect', function () {
    defer.resolve(client);
  });

  // if in 1 second client was not created, try to create it again
  return defer.promise.timeout(1000).catch(function(){
    return createModbusClient();
  });
};

var wait = function(milliseconds) {
  return function(result) {
    var defer = when.defer();
    setTimeout(function(){
      defer.resolve(result);
    }, milliseconds);
    return defer.promise;
  }
};
