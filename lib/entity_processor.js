var _ = require('underscore');
var Backbone = require('backbone');

var EntitySet = require('./entity_set');
var Utils = require('./utils');

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

        for( i=0,len=this._cmds.length;i<len;i++ ){
            cmd = this._cmds[i];
            entity = cmd[1];

            switch( cmd[0] ){
                case EntitySet.CMD_COMPONENT_ADD:
                    componentsToAdd || (componentsToAdd=[]);
                    component = this.registry.createComponent( cmd[2] );
                    component.setEntityId( entity.getEntityId() );
                    componentsToAdd.push( component );
                    break;
                case EntitySet.CMD_COMPONENT_REMOVE:
                    componentsToRemove || (componentsToRemove=[]);
                    componentsToRemove.push( cmd[2] );
                    break;
                case EntitySet.CMD_ENTITY_ADD:
                    entitiesToAdd || (entitiesToAdd=[]);
                    entitiesToAdd.push( entity );
                    break;
                case EntitySet.CMD_ENTITY_REMOVE:
                    entitiesToRemove || (entitiesToRemove=[]);
                    entitiesToRemove.push( entity );
                    break;
            }
        }

        if( componentsToAdd ){
            entitySet.addComponent( componentsToAdd );
        }
        if( componentsToRemove ){
            entitySet.removeComponent( componentsToRemove );
        }
        if( entitiesToAdd ){
            entitySet.add( entitiesToAdd );
        }
        if( entitiesToRemove ){
            entitySet.remove( entitiesToRemove );
        }


        this._cmds = Utils.clearArray( this._cmds );
    },

    addComponentToEntity: function( entity, component ){
        this._cmds.push( [EntitySet.CMD_COMPONENT_ADD, entity, component] );
    },

    removeComponentFromEntity: function( entity, component ){
        this._cmds.push( [EntitySet.CMD_COMPONENT_REMOVE, entity, component] );
    },

    addEntity: function( entity ){
        this._cmds.push( [EntitySet.CMD_ENTITY_ADD, entity] );
    },

    destroyEntity: function (entity){
        this._cmds.push( [EntitySet.CMD_ENTITY_REMOVE, entity] );
    },

});

EntityProcessor.isEntityProcessor = function(ep){
    return ( ep && _.isObject(ep) && ep instanceof EntityProcessor );
}


EntityProcessor.create = function create( attrs, options ){
    var Model = options.Model || EntityProcessor;
    var result = new Model(attrs);
    return result;
}

module.exports = EntityProcessor;