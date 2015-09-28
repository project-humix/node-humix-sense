var config = {
    "module_name":"nfc",
    "commands" : [ "command1", "command2"],
    "events" : ["detect","trigger"],    
    "child_process" : {
        "name" : "./test.sh",
        "params" : ['7'],
        "restart" : 2
    },
    
}

module.exports = config;
