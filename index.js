
var nats ;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var bunyan = require('bunyan');
var log = bunyan.createLogger({ name: 'SenseModule' }); // default console logger
var localEventEmitter = new EventEmitter;
/*
 *    Definition of HumixSenseModule
 */
function HumixSenseModule(config) {


    var self = this;
    EventEmitter.call(this);
    self.config = config;
    // Create child logger for sense module
    self.logger = log.child({ component: config.moduleName });

    if (self.config.debug) {
        self.logger.level('debug');
    }
    self.logger.debug('Creating HumixSenseModule');
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
        var topic = mevnPrefix  + localEvent;
     
        (function (topic, localEvent) {

            nats.subscribe(topic, function (data, replyTo) {
                self.logger.debug('emitting command topic:' + topic);
                var parsedData ;
                  if (data) {
                    try {
                        parsedData = JSON.parse(data);
                    }
                    catch (e) {
                        parsedData=data;
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

    log.info('creating HumixSense communication');

    var self = this;

    if (!(this instanceof HumixSense)) {
        return new HumixSense(conf);
    }
    var natsIP=conf.natsIP||'localhost';
    var natsPort=conf.natsPort||'4222';
    nats = require ('nats').connect('nats://'+natsIP+':'+natsPort);
    self.module = null;;
    self.config = conf;

    if (!self.config) {
        // looking for default config
        log.info('looking for local config...');
        self.config = require('./config.js');

        // if default config doesn't exist, abort.
        if (!self.config) {
            log.error('default config does not exist.');
            process.exit(1);
        }
    }

    var hasLogFile = false;
    if (self.config.log) {
        var cfg = self.config.log;

        var c = { name: 'SenseModule', streams: [] };
        if (cfg) {
            cfg.forEach(function (element, index, array) {
                if (element.file) {
                    var loglevel = element.level || 'info';
                    log.info('creating log file: ' + element.file);
                    log.addStream({ path: element.file, level: loglevel });
                    hasLogFile = true;
                }
            });

        }
    }

    if (!hasLogFile) {
        log.info('creating default log file: ' + self.config.moduleName + '.log');
        log.addStream({ path: self.config.moduleName + '.log' });
    }

    if (self.config.debug) {
        log.level('debug');
    }

    log.debug('config: ' + JSON.stringify(self.config));

    EventEmitter.call(this);

    // register module to humix sense controller

    nats.request('humix.sense.mgmt.register', JSON.stringify(self.config), function () {

        log.debug('Humix Sense received registration from ' + self.config.moduleName + ' module');

        self.module = new HumixSenseModule(self.config);

        log.debug('emit connection event');

        self.emit('connection', self.module);
    });


    nats.subscribe('humix.sense.mgmt.' + self.config.moduleName + '.start', function (request, replyTo) {

        self.emit('start');

    });


    nats.subscribe('humix.sense.mgmt.' + self.config.moduleName + '.stop', function (request, replyTo) {

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
