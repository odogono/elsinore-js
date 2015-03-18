var _ = require('underscore');
var Backbone = require('backbone');

var EntitySet = require('./entity_set');
var Utils = require('./utils');
var CmdBuffer = require('./cmd_buffer/sync');

var EventsAsync = require('./util/events.async');


/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */
var EntityProcessor = Backbone.Model.extend({
    type: 'EntityProcessor',
    isEntityProcessor: true,

    initialize: function( attrs, options ){
        this._cmds = [];  
    },

    start: function(){
    },

    stop: function(){
    },

    onInitialize: function( registry ){
    },

    onUpdate: function( deltaTime, startTime, currentTime, options ){
    },


    applyChanges: function(){
        var i,len,cmd;
        var entity, component;
        var entitySet = this.get('entitySet');
        var componentsToAdd, componentsToRemove, entitiesToAdd, entitiesToRemove;
        var result;

        // log.debug( this.name + ' applying ' + this._cmds.length + ' CMDS' );
        for( i=0,len=this._cmds.length;i<len;i++ ){
            cmd = this._cmds[i];
            entity = cmd[1];
            // log.debug( this.name + ' CMD ' + JSON.stringify(cmd) );

            switch( cmd[0] ){
                case CmdBuffer.CMD_COMPONENT_ADD:
                    // log.debug( this.name + ' adding COMP ' + JSON.stringify(cmd[2]));
                    componentsToAdd || (componentsToAdd=[]);
                    component = this.registry.createComponent( cmd[2] );
                    component.setEntityId( entity.getEntityId() );
                    componentsToAdd.push( component );
                    break;
                case CmdBuffer.CMD_COMPONENT_REMOVE:
                    // log.debug( this.name + ' removing COMP ' + JSON.stringify(cmd[2]));
                    componentsToRemove || (componentsToRemove=[]);
                    componentsToRemove.push( cmd[2] );
                    break;
                case CmdBuffer.CMD_ENTITY_ADD:
                    entitiesToAdd || (entitiesToAdd=[]);
                    entitiesToAdd.push( entity );
                    break;
                case CmdBuffer.CMD_ENTITY_REMOVE:
                    entitiesToRemove || (entitiesToRemove=[]);
                    entitiesToRemove.push( entity );
                    // log.debug('removing entity ' + JSON.stringify(entity) );
                    break;
                default:
                    // log.debug(this.name + ' unknown cmd ' + cmd[0] );
                    break;
            }
        }

        if( componentsToAdd ){
            result = entitySet.addComponent( componentsToAdd );
            componentsToAdd = null;
        }
        if( componentsToRemove ){
            // log.debug('processor removing components ' + JSON.stringify(componentsToRemove) );
            result = entitySet.removeComponent( componentsToRemove );
            componentsToRemove = null;
        }
        if( entitiesToAdd ){
            result = entitySet.addEntity( entitiesToAdd );
            entitiesToAdd = null;
        }

        if( entitiesToRemove ){
            // log.debug('removing entities from ' + entitySet.cid ); //JSON.stringify(entitiesToRemove) );
            result = entitySet.removeEntity( entitiesToRemove );
            // log.debug(' = removed entities ' + JSON.stringify(result) );
            // printE( entitySet );
            entitiesToRemove = null;
        }

        this._cmds = Utils.clearArray( this._cmds );
        return result;
    },

    addComponentToEntity: function( entity, component ){
        this._cmds.push( [CmdBuffer.CMD_COMPONENT_ADD, entity, component] );
    },

    removeComponentFromEntity: function( entity, component ){
        this._cmds.push( [CmdBuffer.CMD_COMPONENT_REMOVE, entity, component] );
    },

    // addEntity: function( entity ){
    //     this._cmds.push( [CmdBuffer.CMD_ENTITY_ADD, entity] );
    // },

    createEntity: function(entity){
        entity = this.registry.createEntity.apply( this.registry, arguments );
        this._cmds.push( [CmdBuffer.CMD_ENTITY_ADD, entity] );
        if( this.isReleasingEvents ){
            return this.applyChanges();
        }
        return entity;
    },

    destroyEntity: function (entity){
        this._cmds.push( [CmdBuffer.CMD_ENTITY_REMOVE, entity] );
        if( this.isReleasingEvents ){
            return this.applyChanges();
        }
        return entity;
    },

    toJSON: function(){
        var result = {};
        result.name = this.name;
        return result;
    },
});

EntityProcessor.prototype = _.extend( EntityProcessor.prototype, EventsAsync );

EntityProcessor.isEntityProcessor = function(ep){
    return ep && ep.isEntityProcessor;
}


EntityProcessor.create = function create( attrs, options ){
    var Model = options.Model || EntityProcessor;
    var result = new Model(attrs);
    return result;
}

module.exports = EntityProcessor;