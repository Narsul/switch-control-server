(function () {
    'use strict';

    var config = require('./config');
    var _ = require('underscore');
    var switches = _(config.get('modbus:switches')).reduce(function (memo, switchParams, switchName) {
        if (switchParams.active) {
            memo[switchName] = switchParams;
        }
        return memo;
    }, {});

    var switchLight = function (name, on) {
        var state = (on) ? 'on' : 'off';

        if (!switches[name] || !switches[name][state]) {
            throw new ReferenceError('Can\'t switch "' + name + '" to state "' + state + '"');
        }

        return doSwitchLight(switches[name][state]);
    };

    var switchAllLightOff = function () {
        return doSwitchLight(config.get('modbus:switchAllOff'));
    };

    var doSwitchLight = function (addressNumber) {
        var when = require('when'),
            defer = when.defer(),
            modbus = require('modbus-stack');

        // IP and port of the MODBUS slave, default port is 502
        var client = require('modbus-stack/client').createClient(config.get('modbus:port'), config.get('modbus:host'));

        client.request(modbus.FUNCTION_CODES.WRITE_SINGLE_COIL, addressNumber, true, function () {
            setTimeout(function () {
                client.request(modbus.FUNCTION_CODES.WRITE_SINGLE_COIL, addressNumber, false, function () {
                    client.end();
                    defer.resolve(true);
                });
            }, config.get('modbus:delayBetweenSignals'));
        });

        return defer.promise;
    };

    var getSwitchStates = function () {
        // 'RIR' contains the "Function Code" that we are going to invoke on the remote device
        var modbus = require('modbus-stack'),
            when = require('when'),
            defer1 = when.defer(),
            defer2 = when.defer();

        // IP and port of the MODBUS slave, default port is 502
        var client = require('modbus-stack/client').createClient(config.get('modbus:port'), config.get('modbus:host'));

        var req1 = client.request(modbus.FUNCTION_CODES.READ_DISCRETE_INPUTS, 0x1, 0x9);
        req1.on('response', defer1.resolve);

        defer1.promise.then(function () {
            var req2 = client.request(modbus.FUNCTION_CODES.READ_DISCRETE_INPUTS, 0x9, 0x13);
            req2.on('response', defer2.resolve);
        });

        return when.join(defer1.promise, defer2.promise)
            .then(function (resultsArr) {
                var _ = require('underscore'),
                    firstByte = resultsArr[0][0] >> 8,
                    secondByte = resultsArr[1][0] >> 8 | ((resultsArr[1][0] & 15) << 8),
                    result = firstByte | (secondByte << 8);

                client.end();
//                console.log(('00' + result.toString(2)).replace(/(\d{4})/g, '$1 '));

                return _(switches).reduce(function (memo, params, name) {
                    memo[name] = !!(result & params.mask);
                    return memo;
                }, {});
            });
    };

    module.exports = {
        getSwitchStates   : getSwitchStates,
        switchLight       : switchLight,
        switchAllLightOff : switchAllLightOff,
        switches          : switches
    };
})();