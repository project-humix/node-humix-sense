var HumixSense = require("../index.js")
//    humix = new HumixSense(config);

var nats = require('nats').connect();
var assert = require('chai').assert
var humix;
var hsm;

before(function(){

    console.log('before running test...');
    
    // setup fake controller
    nats.subscribe('humix.sense.mgmt.register', function(msg, replyto){

        console.log('receive registration event:'+msg);
        nats.publish(replyto, 'register completed');
    });
    

})

describe('module base', function(){

    beforeEach(function(){
        
       
    });
    it('should return a new sensor module object', function(){

        // provide default config. If not provided, the module will lookup module.js in current dir to load the config
        var config = {

            // basic info to config with server
            //"port" : 4222
            
            // define the namespace of this module
            "moduleName":"test",

            // specify the commands to monitor
            "commands" : [ "command1", "command2"],

            // (optional)
            // specify the events that will be gneerated by this module.
            // If not specified, all events generated with event() function will be emitted 
            "events" : ["event1","event2"],

            // (optional)
            // if the module is implemented using other language, specify the process to lunch here
            "childProcess" : {
                "name" : "./test/test.sh",
                "params" : "7",
                "respawn" : true,
                "restart" : 3
            },
            "debug": true
            
        }

        humix = new HumixSense(config);
        assert(humix,' failed to return sensor module object');
    });
    
    it('should return response when register', function(done){

        this.timeout(5000);
        var called = false;
        humix.on('connection', function(humixSensorModule){
            hsm = humixSensorModule;
            assert(hsm, 'fail to return sensor module');
            console.log('Communication with humix-sense is now ready. hsm:'+hsm);

            if(!called){
                done();
                called = true;
            }
        });
    });

    it('should generate sensor event', function(done){

        this.timeout(5000);
        nats.subscribe('humix.sense.test.event.event1',function(msg){

            assert(msg === 'msg','incorrect event message');
            done();
        });

        hsm.event('event1', 'msg');
    });

    it('should receive sensor command', function(done){

        this.timeout(5000);

        hsm.on('command1', function(data){
            console.log('receive data');
            assert(data === 'data', 'incorrect command message');
            done();
        });

        nats.publish('humix.sense.test.command.command1', 'data');
    });


    it('should return ping/pong event', function(done){

        nats.request('humix.sense.mgmt.test.ping','stop',function(){
            
            console.log('pong received');
            done();
        });

        
    });

    it('should receive output from child process', function(done){


        this.timeout(10000);
        hsm.on('stdout',function(data){
            console.log('child_process stdout:'+data);
            done();
        });
    });


    /*
    it('should terminate when receive close command', function(done){

        hsm.on('stop', function(){
            done();
        });

        nats.publish('humix.sense.mgmt.test.stop','stop now');
    });
    */
})

after(function(){

    console.log('after running test...');
})

/*
humix.on('connection', function(humixSensorModule){

    var hsm = humixSensorModule;
    console.log('Communication with humix-sense is now ready. hsm:'+hsm);
    
    // trigger when received topic "humx.sense.test.command.command1"
    hsm.on('command1', function(data){

        console.log('receive command1, data:'+data);
    })

    // trigger when received topic "humix.sense.test.command.command2"
    hsm.on('command2', function(data){

        console.log('receive command2, data:'+data);
    })

    // publish topic "humix.sense.test.event.event1" with value "hello"
    hsm.event('event1','hello');

    // publish topic "humix.sense.test.event.event2" with value {"action":"wakeup"}
    hsm.event('event2','{"action":"wakeup"}');


    
    // child process communication and management
    
    hsm.on('stdout',function(data){
        console.log('child_process stdout:'+data);
    });

    
    hsm.on('stderr_data', function(data){

        console.log('child_process stderr:'+data);

    });
    
    
    hsm.on('childClose', function(data){

        console.log('child process closed');
    })
    
    
});



humix.on("stop", function(){

    console.log('Received close event from humix-sense. Terminating')
});
*/
