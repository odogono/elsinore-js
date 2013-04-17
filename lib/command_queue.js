var Entity = require('../index');

exports.Command = Entity.Entity.extend({
    
    // finished with a callback containing: error, boolean indicating that this command has finished and should be disposed of
    execute: function(options,callback){
        // returns true if the command is finished
        callback( null, true, this );
    },

    // returns an array of properties which should be indexable by the db
    // storeKeys: function(){
    //     var keys = Entity.Entity.prototype.storeKeys.apply(this,arguments);
    //     return _.union( [ "execute_time" ], keys );
    // },
});


exports.CallCommand = exports.Command.extend({
    execute: function(options,callback){
        callback( null, true, this );
    }
});


exports.CommandQueue = Entity.EntityCollection.extend({

    // defaults: function(){
    //     return _.extend(Entity.EntityCollection.prototype.defaults,{
    //         query: { status:{ $ne:2} }
    //     });
    // },

    initialize: function(){
        var self = this;

        if( Entity.EntityCollection.prototype.initialize.apply(this,arguments) ){
            this.items.comparator = function(cmd){
                // print_ins( 'comparator ' + index );
                // retrieve the execution time
                var cmdTime = cmd.get('execute_time');
                return cmdTime;
            };
        }
    },

    // callback returns with error, executeCount and remove count
    process: function(options,callback){
        var self = this, i, len, cmd, eTime, time = this.time(), removes = [];
        var executeCount = 0;
        var finishedCount = 0;

        if( !callback && _.isFunction(options) ){
            callback = options;
        }

        options = (options || {});

        Step(
            function executeCommands(){
                var group = this.group();
                var cmdOptions = {};

                // walk the queue until we meet the first time that is later than the current time
                for( i=0,len=self.items.length;i<len;i++ ){
                    cmd = self.items.models[i];

                    if( cmd.get('execute_time') > time )
                        break;

                    // if( cmd.execute ){
                    // assume that all commands will finish after their initial execution
                    // - they can change this themselves if they wish to continue to execute
                    cmd.isFinished = true;
                    // the result will come back as a callback
                    cmd.execute( cmdOptions, group() );
                    executeCount++;
                    // } else {
                    //     log('cmd_queue process');
                    //     // print_ins( cmd );
                    // }
                }
            },
            function destroyFinishedCommands(err,result,cmds){
                var group = this.group();

                for( i=0,len=self.items.length;i<len;i++ ){
                    cmd = self.items.models[i];
                    if( cmd.isFinished )
                        removes.push(cmd);
                }
                
                for( i=0,len=removes.length;i<len;i++ ){
                    if( !removes[i].isNew() )
                        removes[i].destroyCB({destroyHard:true}, group() );
                }
                
            },
            function finishAndReport(err,result){
                if( err ) throw err;
                // remove processed commands
                // NOTE - this has to happen after the commands have been deleted, because
                // the collection reference is required
                self.items.remove( removes );

                if( callback )
                    callback(err,executeCount, removes.length);
            }
        );
    },


    // returns true if this collection should be serialised as an entity
    // because command queues have particular functionality, the answer is always yes
    shouldSerialise: function(options){
        return true;
    },

    getName: function(){
        return 'items';
    },

    // returns the current time according to the queue
    time: function(){
        return Date.now();
    },

    add: function(models, options) {
        if( _.isString(models) ){
            // attempt to load from entity registry
            var entityDef = Entity.registerEntity( models );

            if( !entityDef ){

            }
            // load from a path

            return this;
        }
            
        return Entity.EntityCollection.prototype.add.apply( this, arguments );
    },

    startRunLoop: function(options, callback){
        options = options || {};
        var self = this;
        var last = Date.now();
        var runLoopOptions = {};
        var fps = options.fps || 1;
        var intervalMs = (1/fps)*1000;
        var startTime = 0;

        var runLoop = function(err){
            if( err ) throw err;
            var now = Date.now();
            var dt = now - last;
            last = now;
            startTime += dt;
            self.process( {dt:(dt/intervalMs), start:startTime, time:now}, processCallback );
            // gameManager.process( (dt/intervalMs), startTime, now, runLoopOptions, processCallback );
        }

        var processCallback = function(err){
            if( err ) throw err;
            // process.nextTick( runLoop );
        }

        
        // if( Common.config.game_manager.loop_active )
        {
            log.info('game manager loop running at ' + fps + 'fps');
            this.intervalId = setInterval( runLoop, intervalMs );    
        }

        if( callback ){
            process.nextTick(function() {
                callback();
            });
        }
    },

    stopRunLoop: function(options){
        if( this.intervalId ){
            clearInterval( this.intervalId );
            this.intervalId = null;
        }
    }

    // flatten: function( options ){
    //     options = (options || {});
    //     var result = Entity.EntityCollection.prototype.flatten.apply( this, arguments );
    //     return result;
    // },
});


exports.create = function( attrs, options ){
    // log('creating command queue with ' + JSON.stringify(attrs) );
    // TODO : create with standard entity create
    attrs = (attrs || {});
    options || (options = {});
    // this option has to be set in order to process any passed items/models
    // correctly
    options.parse = true;
    var result = new exports.CommandQueue( attrs, options );
    result.type = 'cmd_queue';
    return result;
}

Entity.registerEntity('cmd_queue', exports.CommandQueue, {oneToMany:true,create:exports.create} );