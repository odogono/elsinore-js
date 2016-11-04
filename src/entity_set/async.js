import _ from 'underscore';
import {Collection} from 'odgn-backbone-model';

import Entity from '../entity';
import EntitySet from './index';
import CmdBuffer from '../cmd_buffer/async';
import ReusableId from '../util/reusable_id';
import {setEntityIdFromId,toString} from '../util';
// import * as Utils from '../util';
import {getEntityIdFromId,getEntitySetIdFromId} from '../util';
import {ComponentNotFoundError,EntityNotFoundError,ComponentDefNotFoundError} from '../error';
import {ComponentDefCollection} from '../schema';


/**
 * An In-memory Async (Promise-based) entityset
 * 
 * Notes:
 * 
 * the aim should be to resolve updates into a series of commands which precisely describes what should be
 * added/removed updated
 */
class AsyncEntitySet extends EntitySet {
    initialize(entities, options={}){
        this.componentDefs = new ComponentDefCollection();
        // console.log('init AsyncEntitySet');
        options.cmdBuffer = CmdBuffer;
        EntitySet.prototype.initialize.apply(this, arguments);
        // console.log('AsyncEntitySet.initialize',this.id,this.cid,this.getUuid(),'with options',JSON.stringify(options));

        // in a persistent es, these ids would be initialised from a backing store
        this.entityId = new ReusableId(options.entityIdStart || 1);
        this.componentId = new ReusableId(options.componentIdStart || 1);
    }

    open(options={}){
        this._open = true;
        
        return this.getComponentDefs({notifyRegistry:true})
            .then( () => {
                console.log(`finished ${this.type} open`);
                return this;
            })

        // return Promise.resolve(this);
    }

    isOpen(){ return this._open }

    close(){
        this._open = false;
        return Promise.resolve(this);
    }

    destroy( options={} ){
        return Promise.resolve(this);
    }

    /**
     * Registers a component def with this entityset.
     */
    registerComponentDef(data,options={}){
        // if this hasn't been called from the registry, then we forward the request
        // on to the registry, which takes care of decomposing the incoming schemas
        // and then notifying each of the entitySets about the new component defs
        if (!options.fromRegistry) {
            return this.getRegistry().registerComponent(data, { fromES: this }).then( () => this )
        }

        return this.getComponentDefByHash(data.hash).then( existing => {
            this.log('already have existing cdef for', data.hash, existing.esid )
            this._cacheComponentDef( data, existing.esid );
            return existing;
        })
        .catch( err => {
            if( err instanceof ComponentDefNotFoundError ){
                return this._registerComponentDef(data);
            }
            return Promise.reject(err);
            // _.defer( () => {throw err} );
        })
    }

    _registerComponentDef( cdef, options ){
        return new Promise( (resolve,reject) => {
            // console.log('_registerComponentDef adding', cdef.getUri(), cdef.id, cdef.cid, cdef.hash() );
            const clonedDef = cdef.clone();
            // TODO : should use a reusableId here
            // clonedDef.set({id:_.uniqueId('acd')});
            this.componentDefs.add( clonedDef );
            // console.log('_registerComponentDef added', clonedDef.getUri(), clonedDef.id, clonedDef.cid, clonedDef.hash() );
            return resolve(this);
        })
    }

    /**
    *   Returns a component def by its id/uri
    */
    getComponentDef(cdefId, cached) {
        return new Promise( (resolve,reject) => {
            // console.log('huh', this.componentDefs);
            let def = this.componentDefs.get( cdefId );
            if( !def ){
                def = this.componentDefs.getByUri(cdefId);
            }
            if( !def ){
                def = this.componentDefs.getByHash(cdefId);
            }
            if( !def ){
                return reject(new ComponentDefNotFoundError(cdefId));
            }
            return resolve(def);
        })
    }

    /**
    *   Returns a registered component def by its hash
    */
    getComponentDefByHash(hash) {
        return new Promise( (resolve,reject) => {
            const result = this.componentDefs.getByHash(hash);
            if( result ){
                return resolve(result);
            }
            return reject(new ComponentDefNotFoundError(hash));
        })
    }

    /**
    *   Reads component defs into local structures
    *   Returns a promise for an array of registered schemas
    */
    getComponentDefs(options={}) {
        const componentDefs = this.componentDefs.models;

        if( !options.notifyRegistry ){ return Promise.resolve(componentDefs) }
        
        // if this hasn't been called from the registry, then we forward the request
        // on to the registry, which takes care of decomposing the incoming schemas
        // and then notifying each of the entitySets about the new component defs
        return this.getRegistry().registerComponent(componentDefs, {fromES: this} )
            .then( () => componentDefs );
    }


    /**
     * Returns an entity
     */
    getEntity( entityId, options ){
        if (options && options.componentBitFieldOnly) {
            return this.getEntityBitField(entityId);
        }
        return this.getEntityById(entityId);
    }


    /**
     * Returns a bitfield for the specified entityid
     */
    getEntityBitField( entityId ){
        let e = this.get(entityId);
        if( e ){
            return Promise.resolve(e.getComponentBitfield());
        }
        return Promise.reject(new EntityNotFoundError(entityId));
    }

    /**
     * Returns an entity specified by its id
     */
    getEntityById( entityId ){
        const esId = getEntitySetIdFromId(entityId);
        const eId = getEntityIdFromId(entityId);
        let e = this.get(entityId);

        if( !e ){
            // attempt to retrieve the entity using a composite id
            e = this.get( setEntityIdFromId(entityId,this.id) );
        }

        if( e ){
            return Promise.resolve(e);
        }
        
        if( esId != this.id ){
            return Promise.reject(new EntityNotFoundError(entityId, 
                `entity ${eId} does not belong to this entityset (${esId})`));
        }
        // console.log(`looking for eid ${eId} / ${esId}`);

        // this.each( m => console.log('entity model id', m.id) );

        let entity = this.get(eId);
        if( entity ){
            return Promise.resolve(entity);
        }

        return Promise.reject(new EntityNotFoundError(entityId));
    }


    /**
     * Returns a component by its entityid and def id
     */
    getComponentByEntityId( entityId, componentDefId ){
        const result = super.getComponentByEntityId(entityId,componentDefId);
        if( result ){
            return Promise.resolve(result);
        }
        return Promise.reject(new ComponentNotFoundError(entityId,componentDefId));
    }

    /**
     * Takes an (array) of entityIds and returns entity instances with
     * their component bitfields populated, but no components retrieved
     */
    getEntitySignatures( entityIds ){
        const registry = this.getRegistry();

        return new Promise( (resolve,reject) => {
            const result = _.map( entityIds, eId => {
                eId = parseInt(eId, 10);
                let entity = this.get(eId);
                if( entity ){
                    // return a copy of the entity bf
                    return registry.createEntity( null,{id:eId,comBf:entity.getComponentBitfield()} );
                }
                return registry.createEntity(null,{id:eId}); 
            });
            return resolve(result);
        })
    }

    

    /**
     * TODO: finish
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved, options={}) {
        const debug = options.debug;

        // extract entities added which need new ids
        entitiesAdded = _.reduce(entitiesAdded, (result, e) => {
            // console.log('we got,', this.id, this.getUuid(), e.getEntitySetId() );
            if (e.getEntitySetId() !== this.id) {
                result.push(e);
            } else {
                console.log('ALERT! entitiesAdded contains already added entity', e.toJSON() );
            }
            return result;
        }, []);

        // console.log('new entities', toString(entitiesAdded));

        // retrieve ids for the new entities
        return this.entityId.getMultiple( entitiesAdded.length )
            .then( newIds => {
                // console.log('new entity ids', newIds);

                // apply the new ids to the entities. this will
                // also update the components entity ids
                _.each( entitiesAdded, (e,ii) => e.setId( newIds[ii], this.getEntitySetId() ));
            })

            // retrieve ids for the new components
            .then( () => this.componentId.getMultiple( componentsAdded.length) )
            .then( componentIds => {
                // console.log('new component ids', componentIds);
                _.each(componentsAdded, (com, ii) => com.set({id:componentIds[ii]}) );
                // console.log('new components', toString(componentsAdded));
            })
            .then( () => this._applyUpdate(entitiesAdded,
                    entitiesUpdated,
                    entitiesRemoved,
                    componentsAdded,
                    componentsUpdated,
                    componentsRemoved, options) )
    }

    _applyUpdate(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved,options={}){
        const debug = options.debug;
        let ii,len,component,entity;

        const addOptions = {silent:true};
        if( entitiesAdded ){
            if(debug){console.log('entitiesAdded', toString(entitiesAdded))}
            this.add( entitiesAdded, addOptions );
        }
        if( entitiesUpdated ){
            if(debug){console.log('entitiesUpdated', toString(entitiesUpdated))}
            this.add( entitiesUpdated, addOptions );
        }
        if( entitiesRemoved ){
            this.remove( entitiesRemoved, addOptions );
        }

        for( ii=0,len=componentsAdded.length;ii<len;ii++ ){
            component = componentsAdded[ii];
            entity = this.get(component.getEntityId());
            if( entity ){
                entity.addComponent(component,{silent:true});
                this.components.add( componentsAdded[ii] );
                if(debug){console.log('componentsAdded', JSON.stringify(component) );}
            }
        }
        for( ii=0,len=componentsUpdated.length;ii<len;ii++ ){
            component = componentsUpdated[ii];
            // console.log(`!!ES!! updated com ${JSON.stringify(component)} ${component.getEntityId()}`);
            const existing = super.getComponentByEntityId( component.getEntityId(), component.getDefId() );
            // let existing = this.components.get( component );
            if( existing ){
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
                existing.apply( component, {silent:true} );
                // console.log(`!!ES!! EntitySet.update existing ${existing.cid} ${existing.getEntityId()}`);
            } else {
                // console.log(`!!!ES!!! adding component update ${JSON.stringify(component)}`);
                this.components.add( component );
            }
        }
        for( ii=0,len=componentsRemoved.length;ii<len;ii++ ){
            component = componentsRemoved[ii];
            entity = this.get(component.getEntityId());
            if( entity ){
                entity.addComponent(component,{silent:true});
                this.components.remove( component );
                // if(debug){console.log('UPDATE/ADD', componentsAdded[ii].getEntityId(), JSON.stringify(component) );}
            }
        }
        return Promise.resolve({
            entitiesAdded,entitiesUpdated, entitiesRemoved,
            componentsAdded, componentsUpdated, componentsRemoved,
        });
    }
}


AsyncEntitySet.prototype.type = 'AsyncEntitySet';
AsyncEntitySet.prototype.isMemoryEntitySet = false;
AsyncEntitySet.prototype.isAsync = true;
AsyncEntitySet.prototype.cidPrefix = 'aes';


export default AsyncEntitySet;