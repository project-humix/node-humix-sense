/*
  TODO:
  * support different nats port

*/
var nats = require('nats').connect();
var util         = require("util");
var EventEmitter = require("events").EventEmitter;


/*
 *    Definition of HumixSenseModule
 */

function HumixSenseModule(config){

    var self = this;
    EventEmitter.call(this);
    self.config = config;

    var debug = require('debug')('module:'+config.moduleName);
    
    debug('Creating HumixSenseModule');
 
    // Register Command Callback     
    var cmdPrefix = 'humix.sense.'+config.moduleName+".command";

    for ( var i in config.commands){

        var command = config.commands[i];
        var topic = cmdPrefix + "." + command;

        debug("subscribing topic:"+ topic);

        (function(topic,command){
            
            nats.subscribe(topic, function(data){
                debug('topic:'+topic);
                debug('emitting command:' + command);
                self.emit(command,data);
            });
        })(topic,command);
        
    }

    // Child Process management
    // if child process is defined in the config file, start child process here
    
    if(config.childProcess){

        var respawn = require('respawn');

        var process_option = {

            maxRestarts : 0
        }


        var exec_commands = [
            config.childProcess.name,
            config.childProcess.params
        ];

        
        var monitor = respawn(exec_commands, { maxRestarts : config.childProcess.restart });
        
        debug('launch child process: name:' + config.childProcess.name + ", param:" +config.childProcess.params + ", restart:" + config.childProcess.restart);

        monitor.start();
        
        monitor.on('stdout', function(data){

            self.emit('stdout', data); 
        });

        monitor.on('stderr', function(data){

            self.emit('stderr', data); 
        });

        monitor.on('exit', function(code){

            self.emit('childClose', code);
            console.log('child process exited with code ' + code);
  
        });
        
    }
    

    
}

util.inherits(HumixSenseModule, EventEmitter);

HumixSenseModule.prototype.event = function(name,value) {

    var self = this;
    
    var eventPrefix = 'humix.sense.'+self.config.moduleName+".event";

    var topic = eventPrefix + "." + name;

    console.log("publish event with topic :" + topic);
    nats.publish(topic, value);
};

/*
 *    End fo HumixSenseModule Definition
 */


/*
 *    Definition of HumixSense
 */


function HumixSense(conf) {

    var debug = require('debug')('modulebase');
    debug('creating HumixSense communication');
    var self = this;

    if (!(this instanceof HumixSense))
        return new HumixSense(conf);

    
    self.module = null;;
    self.config = conf;
    if(!self.config){

        // looking for default config
        debug('looking for local config...');
        self.config = require('./config.js');

        // if default config doesn't exist, abort. 
        if(!self.config){

            process.exit(1);
        }
    }

    debug("config:"+JSON.stringify(self.config));
   
    
    EventEmitter.call(this);


    // register module to humix sense controller

    nats.request('humix.sense.mgmt.register', JSON.stringify(self.config),function(){

        debug('Humix Sense received registration from ' + self.config.moduleName + ' module');

        
        self.module = new HumixSenseModule(self.config);
        debug('emit connection event');
        self.emit('connection', self.module);
    });

    nats.subscribe('humix.sense.mgmt.'+self.config.moduleName+'.stop', function(request, replyTo) {

        self.emit('stop');
        process.exit(1);
    });
    
    // subscribe module health check status with PING / PONG
    
    nats.subscribe('humix.sense.mgmt.'+self.config.moduleName+'.ping', function(request, replyto){
        nats.publish(replyto, 'humix.sense.mgmt.'+self.config.moduleName+'.pong');
    })
}


util.inherits(HumixSense, EventEmitter);

module.exports = HumixSense;
