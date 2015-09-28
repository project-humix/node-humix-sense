
### Introduction

Essentially, a `humix-sense` module communicate with other modules and the local controller using NATS-based pub/sub messaging model : each module provide the information it collects by publishing 'event', while it also listen for 'command' to trigger actions the module supports. 

This module provides an event-driven model to facilitate the creation of Humix-Sense modules. Basically, you need to proivde a config to specify 
    1) the name of the module
    2) the commands the module accepts
    3) the event the module generates
    4) any child process the module depends upon ( optional )

With such information, `humix-sense` module could automatically generate the namespace for each event generated and monitor the local message bus for incoming commands targeted for this module. In addition, the `humix-sense` module also facilitates life-cycle management of the sensor module: it register the module during start up, monitoring the health check events(e.g. Ping/Pong) and commands (e.g. Stop) from local contorller.

The goal is to simplify the effort required for new sensor modules to communicate with the rest of Humix components, including other sensor modules and `Humix Think` ( the brain)


### How to get the code


### How to use

## Provide module information

## Generate events

## Listen for commands

## Life cycle management

## License