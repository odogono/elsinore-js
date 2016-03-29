import _ from 'underscore';
import Backbone from 'backbone';

import EntitySet from './entity_set';
import * as Utils from './util'

import * as CmdBuffer from './cmd_buffer/sync';

import EventsAsync from './util/events.async';


/**
 * Systems process entity components
 * 
 * Standard design: c.f. http://entity-systems.wikidot.com/rdbms-with-code-in-systems
 */
const EntityProcessor = Backbone.Model.extend({
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

    onUpdate: function( entityArray, timeMs, options ){
    },


    applyChanges: function(){
        let ii,len,cmd;
        let entity, component;
        let entitySet = this.get('entitySet');
        let componentsToAdd, componentsToRemove, entitiesToAdd, entitiesToRemove;
        let result;

        // log.debug( this.name + ' applying ' + this._cmds.length + ' CMDS' );
        for( ii=0,len=this._cmds.length;ii<len;ii++ ){
            cmd = this._cmds[ii];
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
                    // console.debug( this.name + ' removing COMP ' + Utils.stringify(cmd[2]));
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
                    // console.log('removing entity ' + Utils.stringify(entity) );
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
            // console.log('removing entities from ' + entitySet.cid + ' ' + Utils.stringify(entitiesToRemove) );
            result = entitySet.removeEntity( entitiesToRemove );
            // log.debug(' = removed entities ' + Utils.stringify(result) );
            // printE( entitySet );
            entitiesToRemove = null;
        }

        this._cmds = Utils.clearArray( this._cmds );
        return result;
    },

    addComponentToEntity: function( component, entity ){
        this._cmds.push( [CmdBuffer.CMD_COMPONENT_ADD, entity, component] );
    },

    removeComponentFromEntity: function( component, entity ){
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

    destroyEntity: function (entity, apply){
        this._cmds.push( [CmdBuffer.CMD_ENTITY_REMOVE, entity] );
        if( apply || this.isReleasingEvents){
            return this.applyChanges();
        }
        return entity;
    },

    getEntity: function( entityId ){
        return this.entitySet.getEntity( entityId );
    },

    toJSON: function(){
        let result = {};
        result.name = this.name;
        return result;
    },
});

EntityProcessor.prototype = _.extend( EntityProcessor.prototype, EventsAsync );

EntityProcessor.isEntityProcessor = function(ep){
    return ep && ep.isEntityProcessor;
}

EntityProcessor.create = function create( attrs, options={} ){
    const Model = options.Model || EntityProcessor;
    let result = new Model(attrs);
    return result;
}

module.exports = EntityProcessor;