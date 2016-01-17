(function() {
  'use strict';

  var _ = require('underscore');
  var modbus = require('modbus-stack');
  var when = require('when');

  var config = require('./config');
  var switches = _.where(config.get('modbus:switches'), {active: true});

  var switchLight = function(id, on) {
    var state = on ? 'on' : 'off';

    var switchObject = _.findWhere(switches, {id: id});
    if (!_.isObject(switchObject) || !switchObject[state]) {
      throw new ReferenceError('Can\'t switch "' + id + '" to state "' + state + '"');
    }

    return doSwitchLight(switchObject[state]);
  };

  var switchAllLightOff = function() {
    return doSwitchLight(config.get('modbus:switchAllOff'));
  };

  var doSwitchLight = function(addressNumber) {
    var defer = when.defer();

    // IP and port of the MODBUS slave, default port is 502
    var client = require('modbus-stack/client').createClient(config.get('modbus:port'), config.get('modbus:host'));

    client.request(modbus.FUNCTION_CODES.WRITE_SINGLE_COIL, addressNumber, true, function() {
      setTimeout(function() {
        client.request(modbus.FUNCTION_CODES.WRITE_SINGLE_COIL, addressNumber, false, function() {
          client.end();
          defer.resolve(true);
        });
      }, config.get('modbus:delayBetweenSignals'));
    });

    return defer.promise;
  };

  var getSwitchStates = function() {
    // 'RIR' contains the "Function Code" that we are going to invoke on the remote device
    var defer1 = when.defer();
    var defer2 = when.defer();

    // IP and port of the MODBUS slave, default port is 502
    var client = require('modbus-stack/client').createClient(config.get('modbus:port'), config.get('modbus:host'));

    var req1 = client.request(modbus.FUNCTION_CODES.READ_DISCRETE_INPUTS, 0x1, 0x9);
    req1.on('response', defer1.resolve);

    defer1.promise.then(function() {
      var req2 = client.request(modbus.FUNCTION_CODES.READ_DISCRETE_INPUTS, 0x9, 0x13);
      req2.on('response', defer2.resolve);
    });

    return when.join(defer1.promise, defer2.promise)
      .then(function(resultsArr) {
        var firstByte = resultsArr[0][0] >> 8;
        var secondByte = resultsArr[1][0] >> 8 | ((resultsArr[1][0] & 15) << 8);
        var result = firstByte | (secondByte << 8);

        client.end();

        return _.reduce(switches, function(memo, params) {
          var state = Boolean(result & params.mask);
          memo[params.id] = {label: params.label, state: state};
          return memo;
        }, {});
      });
  };

  module.exports = {
    getSwitchStates: getSwitchStates,
    switchLight: switchLight,
    switchAllLightOff: switchAllLightOff,
    switches: switches
  };
})();
