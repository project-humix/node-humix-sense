
var nats ;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var humixLogger = require('humix-logger');
var localEventEmitter = new EventEmitter;

var log;
/*
 *    Definition of HumixSenseModule
 */
function HumixSenseModule(config, logger) {


    var self = this;
    EventEmitter.call(this);
    self.config = config;
    self.logger = logger;

    // Register Command Callback
    var cmdPrefix = 'humix.sense.' + config.moduleName + '.command';

    for (var i in config.commands) {

        var command = config.commands[i];
        var topic = cmdPrefix + '.' + command;
        self.logger.debug('subscribing command topic:' + topic);
        (function (topic, command) {

            nats.subscribe(topic, function (data, replyTo) {
                self.logger.debug('emitting command topic:' + topic);
                var parsedData;
                if (data) {
                    try {
                        parsedData = JSON.parse(data);
                    }
                    catch (e) {
                        parsedData=data;
                    }
                }
                if (parsedData instanceof Object && parsedData.syncCmdId) {

                    delete parsedData.syncCmdId;
                    self.emit(command, JSON.stringify(parsedData), function (result) {

                        nats.publish(replyTo, result);
                    });
                }
                else {

                    self.emit(command, data);
                }
            });
        })(topic, command);
    }


    var localEventPrefix = 'humix.sense.localEvent.';
    for (var i in config.localEvents) {
        var localEvent = config.localEvents[i];
        var topic = localEventPrefix  + localEvent;

        (function (topic, localEvent) {

            nats.subscribe(topic, function (data, replyTo) {
                self.logger.info('emitting command topic:' + topic);
                var parsedData ;
                  if (data && typeof data === 'object') {
                    try {
                        data = JSON.parse(data);
                    }
                    catch (e) {
                       self.logger.error('failed to parse data');
                    }
                }


                localEventEmitter.emit(localEvent, data);

            });
        })(topic, localEvent);
    }
    // Child Process management
    // if child process is defined in the config file, start child process here

    if (config.childProcess) {

        var respawn = require('respawn');

        var process_option = {

            maxRestarts: 0
        }

        var exec_commands = [
            config.childProcess.name,
            config.childProcess.params
        ];

        var monitor = respawn(exec_commands, { maxRestarts: config.childProcess.restart });

        self.logger.debug('launch child process: name:' + config.childProcess.name + ', param:' + config.childProcess.params + ', restart:' + config.childProcess.restart);

        monitor.start();

        monitor.on('stdout', function (data) {
            self.emit('stdout', data);
            self.logger.info('process monitor:' + data);
        });

        monitor.on('stderr', function (data) {

            self.logger.error('process monitor:' + data);
        });

        monitor.on('exit', function (code) {

            self.emit('childClose', code);
            self.logger.info('child process exited with code ' + code);
        });

    }

}

util.inherits(HumixSenseModule, EventEmitter);
HumixSenseModule.prototype.onLocalEvent=function(event ,cb) {

    localEventEmitter.addListener(event,cb);
}
HumixSenseModule.prototype.event = function (name, value) {

    var self = this;
    var logger = this.logger;

    var eventPrefix = 'humix.sense.' + self.config.moduleName + '.event';

    var topic = eventPrefix + '.' + name;
    logger.debug('publishing event topic :' + topic);
    if (value instanceof Object) {
        value = JSON.stringify(value);
    }
    nats.publish(topic, value);
};

HumixSenseModule.prototype.getLogger = function getLogger() {
    return this.logger;
};

HumixSenseModule.prototype.moduleCommand = function (moduleName, command, data) {

    var self = this;
    var logger = this.logger;
    var topic = 'humix.sense.' + moduleName + '.command.' + command;
    logger.debug('module [' + self.config.moduleName + '] publishs a command [' + command + '] to  module ' + moduleName + 'with data +[' + data + ']');
    if (data instanceof Object) {
        data = JSON.stringify(data);
    }
    nats.publish(topic, data);
};

HumixSenseModule.prototype.localEventBroadcast = function (event, data) {

    var self = this;
    var logger = this.logger;
    var topic = 'humix.sense.localEvent.' + event;

    logger.debug('module [' + self.config.moduleName + '] broadcast a module-event [' + event + ']');
    if (data instanceof Object) {
        value = JSON.stringify(value);
    }
    nats.publish(topic, data);
};

HumixSenseModule.prototype.getLogger = function getLogger() {
    return this.logger;
};


/*
 *    End fo HumixSenseModule Definition
 */


/*
 *    Definition of HumixSense
 */

function HumixSense(conf) {


    if (!(this instanceof HumixSense)) {
        return new HumixSense(conf);
    }

    if (!conf) {
        // looking for default config
        conf = require('./config.js');

        // if default config doesn't exist, abort.
        if (!conf) {
            console.error('default config does not exist.');
            process.exit(1);
        }
    }

    var self = this;
    self.config = conf;


    // setup logs

    log = humixLogger.createLogger(conf.moduleName, {filename: conf.log.filename,
                                                     fileLevel: conf.log.fileLevel,
                                                     consoleLevel: conf.log.consoleLevel});
    console.log("creating logger, consolelevel:"+conf.log.consoleLevel);
    log.info('creating HumixSense communication');


    var natsIP = conf.natsIP || 'localhost';
    var natsPort = conf.natsPort || '4222';
    nats = require ('nats').connect('nats://'+natsIP+':'+natsPort);

    self.module = null;;



    log.info('using config: ' + JSON.stringify(self.config));

    EventEmitter.call(this);

    // register module to humix sense controller

    nats.request('humix.sense.mgmt.register', JSON.stringify(self.config), function () {

        log.info('module registration completed');

        self.module = new HumixSenseModule(self.config, log);

        self.emit('connection', self.module);
    });


    nats.subscribe('humix.sense.mgmt.' + self.config.moduleName + '.start', function (request, replyTo) {

        log.debug('received start event');

        self.emit('start');

    });


    nats.subscribe('humix.sense.mgmt.' + self.config.moduleName + '.stop', function (request, replyTo) {

        log.debug('received stop event');

        self.emit('stop');

        // no hard stop here. Module should handle this gracefully
        // process.exit(1);
    });

    // subscribe module health check status with PING / PONG
    nats.subscribe('humix.sense.mgmt.' + self.config.moduleName + '.ping', function (request, replyto) {
        nats.publish(replyto, 'humix.sense.mgmt.' + self.config.moduleName + '.pong');
    })
}

util.inherits(HumixSense, EventEmitter);

module.exports = HumixSense;
