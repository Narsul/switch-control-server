(function () {
    'use strict';

    var express = require('express');
    var methodOverride = require('method-override');
    var morgan = require('morgan');
    var path = require('path');                                                                                         // module for path parsing

    var config = require('./libs/config');
    var modbusQueue = require('./libs/modbus_queue');
    var log = require('./libs/log')(module);
    var app = express();

    app.use(morgan('combined'));
    app.use(methodOverride('X-HTTP-Method-Override'));

    app.get('/switches', function (req, res) {
        modbusQueue.getSwitchStates()
            .then(function(states){
                log.debug(states);
                res.json(states);
            })
            .otherwise(function (error) {
                res.statusCode = 400;
                res.json({error : error.message});
            });
    });

    app.get('/switch-all-off', function (req, res) {
        modbusQueue.switchAllLightOff()
            .then(function(state){
                res.json(state);
            })
            .otherwise(function (error) {
                res.statusCode = 400;
                res.json({error : error.message});
            });
    });

    app.get('/switch', function (req, res) {
        modbusQueue.switchLight(req.query.name, req.query.state === 'on')
            .then(function(state){
                res.json(state);
            })
            .otherwise(function (error) {
                res.statusCode = 400;
                res.json({error : error.message});
            });
    });

    log.info('Starting server on port ' + config.get('port') + ' ...');
    app.listen(config.get('port'));
})();
