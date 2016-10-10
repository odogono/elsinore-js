import _ from 'underscore';
import {Collection} from 'odgn-backbone-model';

import Entity from '../entity';
import EntitySet from './index';
import CmdBuffer from '../cmd_buffer/async';
import ReusableId from '../util/reusable_id';
import * as Utils from '../util';
import {getEntityIdFromId,getEntitySetIdFromId} from '../util';
import {EntityNotFoundError,ComponentDefNotFoundError} from '../error';
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
    }

    open(options={}){
        this.open = true;

        // in a persistent es, these ids would be initialised from a backing store
        this.entityId = new ReusableId(100);
        this.componentId = new ReusableId(10);
        return Promise.resolve(this);
    }

    isOpen(){ return this.open }

    close(){
        this.open = false;
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
            // this.log('already have existing cdef for', data.hash, existing.esid )
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
     * TODO: finish
     * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
     */
    update(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved) {
        
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

        // console.log('new entities', Utils.toString(entitiesAdded));

        return this.entityId.getMultiple( entitiesAdded.length )
            .then( newIds => {
                // console.log('new entity ids', newIds);

                // apply the new ids to the entities. this will
                // also update the components entity ids
                _.each( entitiesAdded, (e,ii) => e.setId( newIds[ii], this.getEntitySetId() ));
            })

            // set new ids on new components
            .then( () => this.componentId.getMultiple( componentsAdded.length) )
            .then( componentIds => {
                // console.log('new component ids', componentIds);
                _.each(componentsAdded, (com, ii) => com.set({id:componentIds}) );
                // console.log('new components', Utils.toString(componentsAdded));
            })
            .then( () => this._applyUpdate(entitiesAdded,
                    entitiesUpdated,
                    entitiesRemoved,
                    componentsAdded,
                    componentsUpdated,
                    componentsRemoved) )
    }

    _applyUpdate(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved){
        return new Promise( (resolve,reject) => {

            const addOptions = {silent:true};
            if( entitiesAdded ){
                this.add( entitiesAdded, addOptions );
            }
            if( entitiesUpdated ){
                this.add( entitiesUpdated, addOptions );
            }
            if( entitiesRemoved ){
                this.remove( entitiesRemoved );
            }

            return resolve({
                entitiesAdded,entitiesUpdated, entitiesRemoved,
                componentsAdded, componentsUpdated, componentsRemoved,
            });
        })
    }
}


AsyncEntitySet.prototype.type = 'AsyncEntitySet';
AsyncEntitySet.prototype.isMemoryEntitySet = false;
AsyncEntitySet.prototype.isAsync = true;
AsyncEntitySet.prototype.cidPrefix = 'aes';


// const AsyncEntitySet = EntitySet.extend({

//     type: 'AsyncEntitySet',
//     // even though we are memory based, setting this to false informs the
//     // registry that we wish to be treated differently.
//     isMemoryEntitySet:false,
//     isAsync: true,
//     cidPrefix: 'aes',


//     initialize: function(entities, options={}){
//         console.log('init AsyncEntitySet');
//         options.cmdBuffer = CmdBuffer;
//         EntitySet.prototype.initialize.apply(this, arguments);
//     },



//     /**
//      * TODO: finish
//      * the async based cmd-buffer calls this function once it has resolved a list of entities and components to be added
//      */
//     update: function(entitiesAdded, entitiesUpdated, entitiesRemoved, componentsAdded, componentsUpdated, componentsRemoved) {
//         return Promise.resolve({
//             entitiesAdded,
//             entitiesUpdated,
//             entitiesRemoved,
//             componentsAdded,
//             componentsUpdated,
//             componentsRemoved,
//         });
//     },
// });

export default AsyncEntitySet;