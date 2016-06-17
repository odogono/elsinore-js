import _ from 'underscore';
import Backbone from 'backbone';
import BitField  from 'odgn-bitfield';

let Component = require('../component');
import Entity from '../entity';
let EntityFilter = require('../entity_filter');
// let Query = require('./entity_set/query')
import * as Utils from '../util';
import {uuid as createUuid} from '../util/uuid';

import * as CmdBuffer from '../cmd_buffer/sync';

let CollectionPrototype = Backbone.Collection.prototype;



/**
 * An EntitySet is a container for entities
 */
let EntitySet = Backbone.Collection.extend({
    type: 'EntitySet',
    isMemoryEntitySet: true,
    isEntitySet: true,
    isAsync: false,

    views: null,

    initialize: function( entities, options ){},

    getEntitySetId: function(){
        return this.id;
    },

    getUuid: function(){
        return this._uuid;
    },

    hash: function(){
        return EntitySet.hash( this, this.getQuery() );
    },

    destroy: function(){
        this.stopListening();
        // this.entities = null;
        this.storage = null;
        this.registry = null;
    },

    size: function(){
        return this.length;
    },

    toJSON: function(){
        let q,result = { cid:this.cid };
        if( (q = this.getQuery()) ){
            result.query = q.toJSON();
        }
        return result;
    },


    // iterator: function(options){
    //     let self = this;
    //     let nextIndex = 0;
    //     return {
    //         next: function(){
    //             return new Promise( function(resolve, reject){
    //                 if( nextIndex < self.entities.length ){
    //                     return resolve( self.entities.at(nextIndex++) );
    //                 }
    //                 return reject({done:true});
    //             });
    //         }
    //     };
    // },

    iterator: function(options){
        let nextIndex = 0;
        return {
            next: () => {
                return nextIndex < this.length ?
                    { value: this.at(nextIndex++), done:false }:
                    { done:true };
            }
        }
    },

    setRegistry: function( registry, options ){
        this._registry = registry;
    },

    getRegistry: function(){
        return this._registry;
    },

    getSchemaRegistry: function(){
        return this.getRegistry().schemaRegistry;
    },


    /**
    *   TODO: move out of here
    */
    attachTo: function( otherEntitySet, options ){
        // load the start state from this entity set
        otherEntitySet.reset( this );
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent );
    },


    /**
    *   TODO: move out of here
    */
    onEntitySetEvent: function( evt ){
        let options;
        let args = Array.prototype.slice.call(arguments, 1);
        switch( evt ){
            // case 'entity:add':
                // return this.add.apply( this, args );
            case 'component:add':
                args[1] = _.extend({}, args[1], {clone:true});
                return this.addComponent.apply(this, args);
            case 'component:remove':
                return this.removeComponent.apply( this, args );
            // case 'entity:remove':
                // return this.remove.apply( this, args );
            case 'reset':
                return this.reset.apply( this.args );
        }
        return this;
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options ){
        return this._cmdBuffer.addComponent( this, component, options );
    },

    /**
    *
    */
    removeComponent: function( component, options ){
        return this._cmdBuffer.removeComponent( this, component, options );
    },

    // add: function( entity, options ){
    //     // 
    // },

    _addModels: function( models, options ){
        return CollectionPrototype.call( this, entity, options );
    },

    /**
    *   Flushes any outstanding commands in the buffer
    */
    flush: function( options ){
        return this._cmdBuffer.flush( this, options );
    },

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity: function( entity, options){
        if( EntitySet.isMemoryEntitySet( entity ) ){
            entity = entity.models;
        }
        return this._cmdBuffer.addEntity( this, entity, options );
    },

    /**
    *
    */
    removeEntity: function(entity, options){
        if( EntitySet.isMemoryEntitySet( entity ) ){
            entity = entity.models;
        }
        return this._cmdBuffer.removeEntity( this, entity, options );
    },

    _createEntity: function( entityId, returnId, options={} ){
        let result;

        if( returnId ){
            options.createId = true;
        }

        if( entityId && parseInt(entityId,10) !== 0 ){
            options.id = entityId;
            // log.debug('create with existing id ' + entityId + ' ' + typeof entityId );
        }

        result = this.getRegistry().createEntity( null, options );

        if( Entity.isEntity(result) ){
            // make sure we don't the entityset id - memory entitysets do not mess
            // with this
            result.setEntitySet( this, false );
        }



        return result;
    },

    _createComponentId: function( ){
        return this.getRegistry().createId();
    },

    _addEntity: function(entity){
        entity.setRegistry( this.getRegistry() );
        // no need for us to issue add events as well as entity:add
        this.add( entity, {silent:true} );
        return entity;
    },

    _removeEntity: function(entity){
        let entityId = Entity.toEntityId(entity);
        // no need for us to issue remove events as well as entity:remove
        this.remove( entity, {silent:true} );
        return entity;
    },

    

    getEntity: function( entity, options ){
        return this.get( entity, options );
    },

    hasEntity: function(entity){
        return this.get( entity ) !== undefined;
    },


    reset: function( entities, options ){
        let ii,len,entity;
        if( entities && entities.isEntitySet ){
            entities = entities.models;
        }

        if( !this.getQuery() ){
            return Backbone.Collection.prototype.reset.call( this, entities );
        }

        Backbone.Collection.prototype.reset.call( this, null, {silent:true} );

        for( ii=0,len=entities.length;ii<len;ii++ ){
            entity = entities[ii];
            if( EntitySet.isEntityOfInterest(this, entity, this.getQuery()) ){
                this.add( entity );
            }
        }

        return entities;
    },



    /**
    *
    */
    /*reset: function(entities, options){
        options || (options = {});
        let opOptions = _.extend({silent: false, removeEmptyEntity:false},options);

        this.removeEntity( this.models, opOptions );
        this._reset();
        
        if( entities ){
            this.addEntity( entities, opOptions );
        }

        if (!options.silent) {
            this.trigger('reset', this, options);
        }
    },//*/

    /**
    *   
    */
    triggerEntityEvent: function( name, entity ){
        let args = _.toArray(arguments);
        let q;
        
        if( (q=this.getQuery()) && !q.execute(entity) ){
            return false;
        }

        // log.debug('accepting EE on ' + this.cid+'/'+this.id );
        if( this.views ){
            _.each( this.views, view => {
                if( (q = view.getQuery()) && q.execute(entity) ){
                    // NOTE: wierd, but it seems that arguments gets clobbered by the time it gets here - don't yet know why
                    view.triggerEntityEvent.apply( view, args );
                }
            });
        }

        return this.trigger.apply( this, args );
    },

    listenToEntityEvent: function( entityOrFilter, name, callback, context ){
        if( !this._entityEvents ){
            this._entityEvents = _.clone(Backbone.Events);
            // this._entityEvents.on('all', function(){
            //     log.debug('eevt: ' + JSON.stringify(arguments) );
            // })
        }

        this._entityEvents.listenTo( this._entityEvents, name, callback );
    },




    // TODO: remove
    doesEntityHaveComponent: function( entityId, componentId, options ){
        let entity;
        if( Utils.isInteger(entityId) ){
            entity = this.at(entityId);
        }

        if( !entity ){
            throw new Error('entity not found: ' + entityId);
        }

        let bf = entity.getComponentBitfield();
        if( BitField.isBitField(componentId) ){
            return BitField.and( componentDef, bf );
        }
        // let componentDefId = ComponentDef.getId( componentDef );
        return bf.get( componentId );

        // return entity.hasComponent( componentId );
    },

    // TODO: remove
    removeComponentFromEntity: function( component, entity, options ){
        let bf = entity.getComponentBitfield();

        if( !bf.get(component.getDefId()) ){
            // log.debug('no component found for ' + component.name + ' ' + bf.toString() );
            throw new Error('no component found for ' + component.name);
        }

        bf.set( component.getDefId(), false );

        delete entity[ component.name ];
        delete entity.components[ component.getDefId() ];

        this.getRegistry().destroyComponent( component );

        return this;
    },

    // TODO: remove
    getComponentFromEntity: function( component, entity, options ){
        return entity.components[ component.getDefId() ];
    },

    // TODO: remove
    doesEntityHaveComponents: function( entity, options ){
        let bf = entity.getComponentBitfield();
        if( bf.count() > 0 ){
            return true;
        }
        let size = _.keys(entity.components).length;
        return size > 0;
    },


    applyEvents: function(){
        if( !this.listeners ){ return; }
        _.each( this.listeners, listener => listener.applyEvents() );
    },


    // _runQuery: function( query, selectEntities ){
    //     let self = this;
    //     let registry = this.getRegistry();
    //     // console.log('_runQuery with ' + this.type + ' ' + query.type );
    //     let result = registry.createEntitySet(null, {register:false});

    //     result = EntitySet.map( this, query, result );

    //     // console.log('selectEntities? ' + selectEntities );
    //     if( selectEntities ){

    //         _.each( selectEntities, function( componentQuery ){
    //             log.debug('looking up ' + JSON.stringify(componentQuery.componentUri));
    //             let componentIIds = registry.getIId( componentQuery.componentUri, true );
    //             let attrs = componentQuery.attrs;
    //             let components, entityIds;

    //             // select all the components
    //             components = result.models.reduce( function(result,e){
    //                 result = result.concat( e.getComponentByIId( componentIIds ) );
    //                 return result;
    //             }, [] );

    //             // select entity id attributes
    //             entityIds = components.reduce( function(result,com){
    //                 let val;
    //                 for( let i=0;i<attrs.length;i++ ){
    //                     val = com.get( attrs[i] );
    //                     if( Entity.isEntityId(val) ){
    //                         result.push( val );
    //                     }
    //                 }
    //                 return result;
    //             },[]);

    //             console.log('selected entity ids ' + JSON.stringify( entityIds ) );
    //             // select the components from this entitySet

    //             // componentQuery.attrs;

    //             // let entityIds = Query.resolveComponentQuery( order, result, registry );
    //         });
    //     }

    //     return result;
    // },

    // /**
    // *   Selects a number of entities from the entityset
    // */
    // whereDeprecated: function( query, attrs, options ){
    //     let result;// = EntitySet.create();
    //     let registry = this.getRegistry();
    //     let filters;
    //     let componentUri;

    //     options || (options={});

    //     result = registry.createEntitySet( null, {register:false} );

    //     // result.setRegistry( registry );
    //     // result.id = registry.createId();

    //     if( !query ){
    //     } else if( _.isString(query) ){
    //         componentUri = registry.getIId( query );
    //         if( attrs ){
    //             query = EntityFilter.create( EntityFilter.ATTRIBUTES, componentUri, attrs );
    //         } else {
    //             query = EntityFilter.create( EntityFilter.ALL, componentUri );
    //         }
    //     }

    //     // log.debug('mapping with ' + query );
        
    //     if( options.view ){
    //         result.type = 'EntitySetView';
    //         result.isEntitySetView = true;

    //         // make <result> listenTo <entitySet> using <query>
    //         EntitySet.listenToEntitySet( result, this, query, options );

    //         // store the view
    //         this.views || (this.views={});
    //         this.views[ EntityFilter.hash( query ) ] = result;
    //         this.trigger('view:create', result);
    //     } else {
    //         result = EntitySet.map( this, query, result );    
    //     }
        
    //     return result;
    // },
});



// EntitySet.prototype[Symbol.iterator] = function() {
//     let entities = this.entities;
//     return {
//         index: 0,
//         next: function(){
//             if( this.index < entities.length ){
//                 return { value: entities[this.index++], done:false };
//             }
//             return {done:true};
//         }
//     }
// };

// // NOTE - should really use iterator rather than these
// _.each( ['forEach', 'each', /*'map',*/ 'where', 'filter'], function(method){
//     EntitySet.prototype[method] = function(){
//         let args = Array.prototype.slice.call(arguments);
//         args.unshift( this.entities.models );
//         return _[method].apply( _, args );
//     };
// });


EntitySet.hash = function( entitySet ){
    let hash = entitySet.toJSON();// entitySet.type;
    return Utils.hash( hash, true );
}












EntitySet.isEntitySet = function(es){
    return es && es.isEntitySet;
}


EntitySet.isMemoryEntitySet = function(es){
    return EntitySet.isEntitySet(es) && es.isMemoryEntitySet;   
}


EntitySet.create = function(options={}){
    let result;
    result = new EntitySet();

    result._cmdBuffer = CmdBuffer.create();
    
    if( !_.isUndefined(options.allowEmptyEntities) ){
        result.allowEmptyEntities = options.allowEmptyEntities;
    } else {
        result.allowEmptyEntities = true;
    }

    if( options.id ){
        result.id = options.id;
    }

    result._uuid = options.uuid || createUuid();

    return result;
};


export default EntitySet;