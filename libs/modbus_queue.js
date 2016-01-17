(function () {
    'use strict';

    var when = require('when');

    var config = require('./config');
    var modbus = require('./modbus');
    var log = require('./log')(module);

    var modbusQueue = {
        _queue     : [],
        _isRunning : false,

        getSwitchStates : function () {
            var job = modbus.getSwitchStates.bind(modbus);
            var jobPromise = this._addJob(job);
            this._runJob();
            return jobPromise;
        },

        switchAllLightOff : function () {
            var job = modbus.switchAllLightOff.bind(modbus);
            var jobPromise = this._addJob(job);
            this._runJob();
            return jobPromise;
        },

        switchLight : function (name, on) {
            var job = modbus.switchLight.bind(modbus, name, on);
            var jobPromise = this._addJob(job);
            this._runJob();
            return jobPromise;
        },

        _addJob : function (job) {
            var defer = when.defer();
            this._queue.push({ job : job, defer : defer });
            return defer.promise;
        },

        _runJob : function () {
            if (this._isRunning) {
                return;
            }

            if (!this._queue.length) {
                return;
            }

            this._isRunning = true;
            var item = this._queue.pop();
            var delay = require('when/delay');
            delay(config.get('modbusQueue:delay'), item.job())
                .then(function (result) {
                    item.defer.resolve(result);
                    log.debug('Completed modbus job');
                    this._isRunning = false;
                    this._runJob();
                }.bind(this))
                .otherwise(function (error) {
                    item.defer.reject(error);
                    this._isRunning = false;
                    log.error('Failed to complete modbus task: ' + error.message);
                    throw error;
                }.bind(this));
        }
    };

    module.exports = modbusQueue;
})();
