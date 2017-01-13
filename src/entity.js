
import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import {hash,isInteger,setEntityIdFromId} from './util';

import Component from './component';
import Model from './model';
import Registry from './registry';

// const ENTITY_ID_MAX = Math.pow(2,31)-1;
// const ENTITY_SET_ID_MAX = Math.pow(2,21)-1;


/**
 * An entity is a container for components
 */
export default class Entity extends Model {
    
    initialize(attrs, options){
        let eid = -1,esid = 0, comBf;

        if( attrs ){
            if( !_.isUndefined(attrs['@e']) ){
                eid = attrs['@e'];
            }
            if( !_.isUndefined(attrs['@es']) ){
                esid = attrs['@es'];
            }

            // if( (eid = attrs['@e']) ){
            //     delete attrs['e'];
            // }
            // if( (esid = attrs['@es']) ){
            //     delete attrs['es'];
            // }
            if( (comBf = attrs.comBf) ){
                // copy the incoming bitfield
                attrs.comBf = BitField.create(comBf);
            }
        }
        
        if( options && options.registry ){
            this.registry = options.registry;
            if( eid === -1 ){
                eid = this.registry.createId();
            }
        }

        
        if( !attrs || _.isUndefined(attrs.id) ){
            this.setId(eid, esid); 
        }

        this.components = [];

        
        // call super!
        Model.prototype.initialize.apply(this,arguments);
    }


    isNew() {
        return this.id === 0;
    }

    setId( entityId, entitySetId ){
        if( entitySetId !== undefined ){
            entityId = setEntityIdFromId( entityId, entitySetId );
        }

        this.set({id: entityId});
        
        // update all attached components
        _.each( this.getComponents(), component => component.setEntityId( entityId ) );
    }

    setEntityId( id ){
        var eid = this.id;
        // // the entity id is set as the low 30 bits 
        // // eid += (id & 0x3fffffff) - (eid & 0x3fffffff);
        // the entity id is set as the low 32 bits 
        eid += (id & 0xffffffff) - (eid & 0xffffffff);
        this.set({id:eid});
    }

    getEntityId(){
        // return this.get('eid') & 0x3fffffff;
        return this.get('id') & 0xffffffff;
    }

    setEntitySetId( id ){
        var eid = this.get('id');
        // the es id is set as the high 21 bits
        // this.set( 'eid', (id & 0x3fffff) * 0x40000000 + (eid & 0x3fffffff) );
        eid = (id & 0x1fffff) * 0x100000000 +    (eid & 0xffffffff);
        this.set({id:eid});
    }

    getEntitySetId(){
        var id = this.get('id');
        // return (id - (id & 0x3fffffff))  / 0x40000000;
        return    (id - (id & 0xffffffff)) /  0x100000000;
    }

    setEntitySet( es, setId=true ){
        this._entitySet = es;
        this.setRegistry( es.getRegistry() );
        if( setId ){
            this.setEntitySetId(es.id);
        }
    }

    getEntitySet(){
        return this._entitySet;
    }

    destroy(){
        if( this._entitySet ){
            this._entitySet.removeEntity( this );
        }
    }

    toJSON(options={}){
        let components = _.map( this.getComponents(), c => c.toJSON(options));
        // if( options.flatEntity ){
        //     return components;
        // }
        return components;

        // if( this.id !== 0 ){

        // }
        // return 

        // if( options.full ){
        //     return {
        //         id: this.id,
        //         c: _.map( this.getComponents(), c => c.toJSON({full:true}) )
        //     };
        // }
        // return {
        //     id: this.id,
        //     eid: this.getEntityId(),
        //     esid: this.getEntitySetId(),
        //     bf: this.getComponentBitfield().toString()
        // };
    }

    hash(asString){
        var result = 0;
        for( var sid in this.components ){
            result += this.components[sid].hash(true);
        }
        if( result === 0 ){ return 0; }
        return hash( result, asString );
    }

    addComponent( component ){
        var existing;
        if( !component ){ return this; }
        if(Array.isArray(component)){ 
            _.each(component, c => this.addComponent(c));
            return this;
        }
        if( !component.getDefId() ){
            throw new Error('attempt to add invalid component', component);
        }
        existing = this.components[ component.getDefId() ];
        if( existing ){
            this.removeComponent( existing );
        }
        // console.log('adding', component.getDefId() );
        component.setEntityId( this.id, this.cid );
        component._entity = this;
        this[ component.name ] = component;
        this.components[ component.getDefId() ] = component;
        this.getComponentBitfield().set( component.getDefId(), true );
        component.on('all', this._onComponentEvent, this);
        if( _.isFunction(component.onAdded) ){
            component.onAdded(this);
        }
        return this;
    }

    /**
     * Returns an array of all the components associated with this entity
     */
    getComponents( componentIds ){
        if( !this.components ){
            return null;
        }
        componentIds = componentIds || this.getComponentBitfield().toValues();
        return _.reduce( componentIds, (result,id) => {
            const com = this.components[id];
            if( com ){ result.push( com ); }
            return result;
        }, []);
    }

    removeComponent( component ){
        if( !component ){ return this; }
        
        // NOTE - the below is contentious
        // it was commented out to allow es events to continue to make sense
        // perhaps the old entity id should be retained somewhere else?
        // component.setEntityId( null );
        component._entity = null;
        delete this[ component.name ];
        delete this.components[ component.getDefId() ];
        this.getComponentBitfield().set( component.getDefId(), false );
        component.off('all', this._onComponentEvent, this);
        if( _.isFunction(component.onRemoved) ){
            component.onRemoved(this);
        }
        return this;
    }

    /**
     * 
     */
    removeComponents( componentIds ){
        componentIds = componentIds || this.getComponentBitfield().toValues();

        return _.reduce( componentIds, (result,id) => {
            const com = this.components[id];
            if( com ){
                this.removeComponent(com);
                result.push(com);
            }
            return result;
        },[]);
    }

    getComponentByIId( componentIId ){
        componentIId = this.getRegistry().getIId( componentIId );
        if( Array.isArray(componentIId) ) {
            return _.map( componentIId, id => this.components[id] )
        }
        return this.components[ componentIId ];
    }

    hasComponent( componentIId ){
        if( Component.isComponent(componentIId) ){
            componentIId = componentIId.getDefId();
        } else if( _.isString(componentIId) ){
            componentIId = this.getRegistry().getIId( componentIId );
        }
        return this.getComponentBitfield().get( componentIId );
    }

    hasComponents(){
        return _.keys(this.components).length > 0;
    }

    getComponentBitfield(){
        var bf = this.get('comBf');
        if( !bf ){
            // TODO: the size must be configured from somewhere - otherwise will run out of space
            bf = BitField.create();
            this.set('comBf', bf);
        }
        return bf;
    }


    /**
    *   The number of components on this entity
    */
    getComponentCount(){
        return _.keys(this.components).length;
        // return this.getComponentBitfield().count();
    }


    triggerEntityEvent(){
        let es = this.getRegistry();
        let args = _.toArray( arguments );
        args.splice(1, 0, this);
        if( es ){
            // so we end up passing evtName, recipientEntity, ... 
            es.triggerEntityEvent.apply( es, args );
        }
    }

    /**
    *   Reacts to events triggered by contained components
    */
    _onComponentEvent(event, component, options) {
        if (event === 'destroy'){
            this.removeComponent(component, options);
        }
        if( event === 'change' ){
            event = 'component:change';
            // log.debug('_onComponentEvent ' + ' '  + ' ' + JSON.stringify(arguments));
            this.trigger(event, component, options);
        }
    }

}

Entity.prototype.type = 'Entity';
Entity.prototype.isEntity = true;
Entity.prototype.cidPrefix = 'e';

Entity.createId = function(){
    return _.uniqueId('e');
}


// Entity.getEntityIdFromId = function( id ){
//     return (id & 0xffffffff);
// }

// Entity.getEntitySetIdFromId = function( id ){
//     return (id - (id & 0xffffffff)) /  0x100000000;
// }

// Entity.setEntityIdFromId = function( eid, esid ){
//     return (esid & 0x1fffff) * 0x100000000 + (eid & 0xffffffff);
// }


// Entity.createWithComponents = function( components, options={} ){
//     let result = new Entity();
//     result.components = [];
//     result.cid = Entity.createId();

//     return result;
// }

Entity.isEntity = function( entity ){
    return entity && entity.isEntity;
};

Entity.isEntityId = function( id ){
    return isInteger( id );
}

Entity.getEntityId = function( entity ){
    if( entity && entity.getEntityId ){
        return entity.getEntityId();
    }
    return null;
}

Entity.toEntityId = function( entityId ){
    if( Entity.isEntity(entityId) ){
        return entityId.id;
    }
    return entityId;
};

Entity.toEntity = function( entity = 0, options ){
    if( isInteger(entity) ){
        return Entity.create( entity, options );
    }
    
    if( Entity.isEntity(entity) ){ return entity; }



    return null;
};