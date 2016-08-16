
import BitField  from 'odgn-bitfield';
import _ from 'underscore';
import * as Utils from './util';
import {printIns} from './util';

import Component from './component';
import Model from './model';
import Registry from './registry';
// var Component = require('./component');
// var Model = require('./model');

// const ENTITY_ID_MAX = Math.pow(2,31)-1;
// const ENTITY_SET_ID_MAX = Math.pow(2,21)-1;

// printIns( Utils );

/**
 * An entity is a container for components
 */
const Entity = Model.extend({
    type: 'Entity',
    isEntity: true,

    isNew: function() {
        return this.get('id') === 0;
    },

    setId: function( entityId, entitySetId ){
        if( entitySetId !== undefined ){
            entityId = Utils.setEntityIdFromId( entityId, entitySetId );
        }
        this.set({id: entityId});
        var components = this.getComponents();
        _.each( components, component => component.setEntityId( entityId ) );
    },

    setEntityId: function( id ){
        var eid = this.get('id');
        // // the entity id is set as the low 30 bits 
        // // eid += (id & 0x3fffffff) - (eid & 0x3fffffff);
        // the entity id is set as the low 32 bits 
        eid += (id & 0xffffffff) - (eid & 0xffffffff);
        this.set({id:eid});
    },

    getEntityId: function(){
        // return this.get('eid') & 0x3fffffff;
        return this.get('id') & 0xffffffff;
    },

    setEntitySetId: function( id ){
        var eid = this.get('id');
        // the es id is set as the high 21 bits
        // this.set( 'eid', (id & 0x3fffff) * 0x40000000 + (eid & 0x3fffffff) );
        eid = (id & 0x1fffff) * 0x100000000 +    (eid & 0xffffffff);
        this.set({id:eid});
    },

    getEntitySetId: function(){
        var id = this.get('id');
        // return (id - (id & 0x3fffffff))  / 0x40000000;
        return    (id - (id & 0xffffffff)) /  0x100000000;
    },

    setEntitySet: function( es, setId=true ){
        this._entitySet = es;
        this.setRegistry( es.getRegistry() );
        if( setId ){
            this.setEntitySetId(es.id);
        }
    },

    getEntitySet: function(){
        return this._entitySet;
    },

    destroy: function(){
        if( this._entitySet ){
            this._entitySet.removeEntity( this );
        }
    },

    toJSON: function(options={}){
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
    },

    hash: function(asString){
        var result = 0;
        for( var sid in this.components ){
            result += this.components[sid].hash(true);
        }
        if( result === 0 ){ return 0; }
        return Utils.hash( result, asString );
    },

    addComponent: function( component ){
        var existing;
        if( !component ){ return this; }
        if(_.isArray(component)){ 
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
        component.setEntityId( this.id );
        component._entity = this;
        this[ component.name ] = component;
        this.components[ component.getDefId() ] = component;
        this.getComponentBitfield().set( component.getDefId(), true );
        component.on('all', this._onComponentEvent, this);
        return this;
    },

    getComponents: function( componentIds ){
        componentIds = componentIds || this.getComponentBitfield().toValues();
        return _.reduce( componentIds, (result,id) => {
            let com = this.components[id];
            if( com ){ result.push( com ); }
            return result;
        }, []);
    },

    removeComponent: function( component ){
        if( !component ){ return this; }
        component.setEntityId( null );
        component._entity = null;
        delete this[ component.name ];
        delete this.components[ component.getDefId() ];
        this.getComponentBitfield().set( component.getDefId(), false );
        component.off('all', this._onComponentEvent, this);
        return this;
    },

    removeComponents: function( componentIds ){
        let components = this.components;
        componentIds = componentIds || this.getComponentBitfield().toValues();
        _.each( componentIds, id => {
            let com = components[id];
            if( com ){
                this.removeComponent( com );
            }
        })
    },

    getComponentByIId: function( componentIId ){
        var self = this;
        componentIId = this.getRegistry().getIId( componentIId );
        if( _.isArray(componentIId) ) {
            return _.map( componentIId, id => self.components[id] )
        }
        return this.components[ componentIId ];
    },

    hasComponent: function( componentIId ){
        if( Component.isComponent(componentIId) ){
            componentIId = componentIId.getDefId();
        } else if( _.isString(componentIId) ){
            componentIId = this.getRegistry().getIId( componentIId );
        }
        return this.getComponentBitfield().get( componentIId );
    },

    hasComponents: function(){
        return _.keys(this.components).length > 0;
    },

    getComponentBitfield: function(){
        var bf = this.get('comBf');
        if( !bf ){
            // TODO: the size must be configured from somewhere - otherwise will run out of space
            bf = BitField.create();
            this.set('comBf', bf);
        }
        return bf;
    },


    /**
    *   The number of components on this entity
    */
    getComponentCount: function(){
        return _.keys(this.components).length;
        // return this.getComponentBitfield().count();
    },


    triggerEntityEvent: function(){
        let es = this.getRegistry();
        let args = _.toArray( arguments );
        args.splice(1, 0, this);
        if( es ){
            // so we end up passing evtName, recipientEntity, ... 
            es.triggerEntityEvent.apply( es, args );
        }
    },

    /**
    *   Reacts to events triggered by contained components
    */
    _onComponentEvent: function(event, component, options) {
        if (event === 'destroy'){
            this.removeComponent(component, options);
        }
        if( event === 'change' ){
            event = 'component:change';
            // log.debug('_onComponentEvent ' + ' '  + ' ' + JSON.stringify(arguments));
            this.trigger(event, component, options);
        }
    }

});

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

/**
*
*/
Entity.create = function(entityId, entitySetId){
    let options = {};
    let result = new Entity();
    let registry;
    result.components = [];
    result.cid = Entity.createId();

    if(_.isObject(entitySetId)){
        options = entitySetId;
        entitySetId = 0;
    }
    // console.log('Entity.create', arguments);

    registry = options.registry;

    if( Registry.isRegistry(entityId) ){
        registry = entityId;
        entityId = 0;
    }

    if( registry ){
        result.setRegistry( registry );

        entityId = entityId || options.id || registry.createId();
        result.setId( entityId );

        // as a convenience, we can pass an array of components as the 2nd arg
        // and they will be added to the entity

        // console.log('components? ', options[0], _.isObject(options), Array.isArray(options), options )

        let components = options['@c'] || ((_.isArray(options) && options[0])?options:null);
        if(components){
            components = result.getRegistry().createComponent(components);
            result.addComponent(components);
        }
        return result;
    }

    if( _.isUndefined(entityId) ){
        entityId = 0;
    }
    
    // if( _.isUndefined(entitySetId) ){
    //     entitySetId = 0;
    // }

    result.setId( entityId, entitySetId );
    // entityId = Utils.setEntityIdFromId( entityId, entitySetId );
    // result.set({id: entityId});

    // result.setEntitySetId( entitySetId );
    // result.setEntityId( entityId );
    
    return result;
};

Entity.isEntity = function( entity ){
    return entity && entity.isEntity;
};

Entity.isEntityId = function( id ){
    return Utils.isInteger( id );
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
    if( Utils.isInteger(entity) ){
        return Entity.create( entity, options );
    }
    
    if( Entity.isEntity(entity) ){ return entity; }



    return null;
};

export default Entity;