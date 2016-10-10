import _ from 'underscore';
import {Collection,Events} from 'odgn-backbone-model';
import BitField  from 'odgn-bitfield';

import Component from '../component';
import Entity from '../entity';
import EntityFilter from '../entity_filter';
import * as Utils from '../util';
import {uuid as createUuid} from '../util/uuid';

// import * as CmdBuffer from '../cmd_buffer/sync';
import CmdBuffer from '../cmd_buffer/sync';


let CollectionPrototype = Collection.prototype;


class ComponentCollection extends Collection {}
ComponentCollection.model = Component;


/**
 * An EntitySet is a container for entities
 */
export default class EntitySet extends Collection {
    
    initialize( entities, options={} ){
        let cmdBuffer = CmdBuffer;
        this._uuid = options.uuid || createUuid();
        this.cid = _.uniqueId('es');
        this.components = new ComponentCollection();

        if( options['@es'] )
            this.id = options['@es'];
        if( options['id'] )
            this.id = options['id'];

        if( options.cmdBuffer ){
            cmdBuffer = options.cmdBuffer;
        }
        this._cmdBuffer = new cmdBuffer();

        // this.listenTo( this,'all', (name,models) => {
        //     switch(name){
        //         case 'component:add':
        //             break;
        //         case 'component:remove':
        //             break;
        //         case 'component:update':
        //             break;
        //     }
        //     console.log('ES.listenTo', name);
        // } );

        this.allowEmptyEntities = _.isUndefined(options.allowEmptyEntities) ? true : options.allowEmptyEntities;
    }

    getEntitySetId(){
        return this.id;
    }

    getUuid(){
        return this._uuid;
    }

    hash(){
        return EntitySet.hash( this, this.getQuery() );
    }

    destroy(){
        this.stopListening();
        // this.entities = null;
        this.storage = null;
        this.registry = null;
    }

    size(){
        return this.length;
    }

    toJSON(options={}){
        let q,result = { uuid:this._uuid };// { cid:this.cid };
        // if( (q = this.getQuery()) ){
        //     result.query = q.toJSON();
        // }

        if( options.mapCdefUri ){
            options.cdefMap = this.getSchemaRegistry().getComponentDefUris();
        }
        options.flatEntity = true;

        result['@e'] = this.models.reduce( (acc,e) => {
            return acc.concat( e.toJSON(options) );
        }, []);

        // result['@e'] = this.models.map( e => e.toJSON(options));
        // result['@e'] = this.constructor.__super__.toJSON.apply(this, options);

        // result['@r'] = this.getSchemaRegistry().toJSON();

        return result;
    }


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

    iterator(options){
        let nextIndex = 0;
        return {
            next: () => {
                return nextIndex < this.length ?
                    { value: this.at(nextIndex++), done:false }:
                    { done:true };
            }
        }
    }

    setRegistry( registry, options ){
        this._registry = registry;
    }

    getRegistry(){
        return this._registry;
    }

    getSchemaRegistry(){
        return this.getRegistry().schemaRegistry;
    }


    /**
    *   TODO: move out of here
    */
    attachTo( otherEntitySet, options ){
        // load the start state from this entity set
        otherEntitySet.reset( this );
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent );
    }


    /**
    *   TODO: move out of here
    */
    onEntitySetEvent( evt ){
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
    }


    /**
    * Adds a component to this set
    */
    addComponent(component, options ){
        return this._cmdBuffer.addComponent( this, component, options );
    }

    /**
     * Returns an existing component instance (if it exists)
     */
    getComponent(component){
        let componentId;
        if( Utils.isInteger(component) ){
            componentId = component;
        } else if( Component.isComponent(component) ){
            componentId = component.id;
        }
        
        return this.components.get(componentId);
    }

    /**
    *
    */
    removeComponent( component, options ){
        return this._cmdBuffer.removeComponent( this, component, options );
    }

    // add: function( entity, options ){
    //     // 
    // },

    _addModels( models, options ){
        return CollectionPrototype.call( this, entity, options );
    }

    /**
    *   Flushes any outstanding commands in the buffer
    */
    flush( options ){
        return this._cmdBuffer.flush( this, options );
    }

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity( entity, options){
        if( EntitySet.isMemoryEntitySet( entity ) ){
            entity = entity.models;
        }
        return this._cmdBuffer.addEntity( this, entity, options );
    }

    /**
    *
    */
    removeEntity(entity, options){
        if( EntitySet.isMemoryEntitySet( entity ) ){
            entity = entity.models;
        }
        return this._cmdBuffer.removeEntity( this, entity, options );
    }


    _createEntity( entityId, returnId, options={} ){
        let result;
        const registry = this.getRegistry();

        entityId = parseInt(entityId,10) || 0;

        if( entityId <= 0 ){
            entityId = registry.createId();
        }

        if( returnId ){
            return entityId;
        }

        result = registry.createEntity(null,{'@e':entityId});
        // make sure we don't set the entityset id - memory entitysets retain
        // the original entityset id
        result.setEntitySet( this, false );
        
        return result;
    }

    _createComponentId( ){
        return this.getRegistry().createId();
    }

    _addEntity(entity){
        entity.setRegistry( this.getRegistry() );
        // no need for us to issue add events as well as entity:add
        this.add( entity, {silent:true} );
        return entity;
    }

    _removeEntity(entity){
        let entityId = Entity.toEntityId(entity);
        // no need for us to issue remove events as well as entity:remove
        this.remove( entity, {silent:true} );
        return entity;
    }

    

    getEntity( entity, options ){
        return this.get( entity, options );
    }

    hasEntity(entity){
        return this.get( entity ) !== undefined;
    }


    /**
     * TODO: finish
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved) {
        let ii,len,compoinent;
        
        for( ii=0,len=componentsAdded.length;ii<len;ii++ ){
            this.components.add( componentsAdded[ii] );
            // console.log('UPDATE/ADD', componentsAdded[ii].getEntityId() );
        }
        for( ii=0,len=componentsUpdated.length;ii<len;ii++ ){
            let existing = this.components.get( componentsUpdated[ii] );
            if( existing ){
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
                existing.apply( componentsUpdated[ii], {silent:true} );
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
            } else {
                // console.log(`!!!ES!!! adding component update ${JSON.stringify(componentsUpdated[ii])}`);
                this.components.add( componentsUpdated[ii] );
            }
        }
        for( ii=0,len=componentsRemoved.length;ii<len;ii++ ){
            this.components.remove( componentsRemoved[ii] );
        }
    }

    /**
     * Replaces the entitySets entities with the specified entities
     */
    reset( entities, options ){
        let ii,len,entity;
        if( entities && entities.isEntitySet ){
            // console.log('reset from',entities.cid,'to',this.cid,'count', entities.models.length);
            entities = entities.models;
        }

        const query = this.getQuery();

        if( !query || query.isEmpty() ){
            // console.log('reset - no query');
            return CollectionPrototype.reset.call( this, entities );
        }

        // console.log('reset - using query', query );
        CollectionPrototype.reset.call( this, null, {silent:true} );

        for( ii=0,len=entities.length;ii<len;ii++ ){
            entity = entities[ii];
            if( EntitySet.isEntityOfInterest(this, entity, query) ){
                this.add( entity );
            }
        }

        return entities;
    }



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
    triggerEntityEvent( name, entity ){
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
    }

    listenToEntityEvent( entityOrFilter, name, callback, context ){
        if( !this._entityEvents ){
            this._entityEvents = _.clone(Events);
            // this._entityEvents.on('all', function(){
            //     log.debug('eevt: ' + JSON.stringify(arguments) );
            // })
        }

        this._entityEvents.listenTo( this._entityEvents, name, callback );
    }




    // TODO: remove
    doesEntityHaveComponent( entityId, componentId, options ){
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
    }

    // TODO: remove
    removeComponentFromEntity( component, entity, options ){
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
    }

    // TODO: remove
    getComponentFromEntity( component, entity, options ){
        return entity.components[ component.getDefId() ];
    }

    // TODO: remove
    doesEntityHaveComponents( entity, options ){
        let bf = entity.getComponentBitfield();
        if( bf.count() > 0 ){
            return true;
        }
        let size = _.keys(entity.components).length;
        return size > 0;
    }


    applyEvents(){
        if( !this.listeners ){ return; }
        _.each( this.listeners, listener => listener.applyEvents() );
    }

}

EntitySet.prototype.type = 'EntitySet';
EntitySet.prototype.isMemoryEntitySet = true;
EntitySet.prototype.isEntitySet = true;
EntitySet.prototype.isAsync = false;
EntitySet.prototype.cidPrefix = 'es';
EntitySet.prototype.views = null;



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
