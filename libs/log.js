(function () {
    'use strict';

    var winston = require('winston');

    function getLogger(module) {
        var path = module.filename.split('/').slice(-2).join('/');                                                      // show label with file name, that shows the message

        return new winston.Logger({
            transports : [
                new winston.transports.Console({
                    colorize  : true,
                    level     : 'debug',
                    label     : path,
                    timestamp : true
                })
            ]
        });
    }

    module.exports = getLogger;
})();
