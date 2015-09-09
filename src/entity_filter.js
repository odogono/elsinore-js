'use strict';

let _ = require('underscore');
let Backbone = require('backbone');
let BitField = require('odgn-bitfield');
let Utils = require('./utils');
let Entity = require('./entity');

export const ALL = 0; // entities must have all the specified components
export const ANY = 1; // entities must have one or any of the specified components
export const SOME = 2; // entities must have at least one component
export const NONE = 3; // entities should not have any of the specified components
export const INCLUDE = 4; // the filter will only include specified components
export const EXCLUDE = 5; // the filter will exclude specified components
export const ROOT = 6; // kind of a NO-OP


function EntityFilter(){
}

_.extend( EntityFilter.prototype, {
    add: function( type, bitField ){
        let existing;
        if( isEntityFilter(type) ){
            for (let t in type.filters) {
                this.add( t, type.filters[t] );
            }
            return;
        }
        bitField = bitField || BitField.create();
        if( !(existing = this.filters[type]) ){
            this.filters[type] = bitField;
        } else {
            existing.set( bitField );
        }
    },

    getValues: function(index){
        let filter = this.filters[index || ALL ];
        return filter.toValues();
    },

    accept: function( entity, options ){
        let filter, bitField;
        let ebf;// = BitField.isBitField(entity) ? entity : entity.getComponentBitfield();
        let registry = options ? options.registry : null;

        if( BitField.isBitField(entity) ){
            ebf = entity;
            entity = true;
        } else {
            ebf = entity.getComponentBitfield();
        }


        for (let type in this.filters) {
            bitField = this.filters[type];
            // log.debug('EF.accept ' + type + ' ' + bitField.toString() );
            if( entity && type == INCLUDE ){
                
                // printE( entity );
                entity = EntityFilterTransform( type, registry, entity, ebf, bitField );
                // printE( entity );
            }
            else if( !accept( type, ebf, bitField, true ) ){
                return null;
            }
        }
        return entity;
    },

    hash: function( asString ){
        return Utils.hash( 'EntityFilter' + JSON.stringify(this), asString );
    },

    toJSON: function(){
        let bitField, result = {};
        for (let type in this.filters) {
            result[type] = this.filters[type].toValues();
        }
        return result;
    }

});


function EntityFilterTransform( type, registry, entity, entityBitField, filterBitField ){
    let ii, len, defId, bf, ebf, vals, isInclude, isExclude, result;
    isInclude = (type == INCLUDE);
    isExclude = (type == EXCLUDE);

    result = registry.cloneEntity( entity );

    // log.debug('EFT ' + type + ' ' + isInclude + ' ' + entityBitField.toJSON() + ' ' + filterBitField.toJSON() );
    if( isInclude ){
        // iterate through each of the entities components (as c IIDs)
        vals = entityBitField.toValues();
        // log.debug('EFT include ' + vals );
        for( ii=0,len=vals.length;ii<len;ii++ ){
            defId = vals[ii];

            if( !filterBitField.get(defId) ){
                result.removeComponent( result.components[defId] );
            }
        }
    // handle exclude filter, and also no filter specified
    } else {
        vals = entityBitField.toValues();
        for( ii=0,len=vals.length;ii<len;ii++ ){
            defId = vals[ii];
            if( !isExclude || !bitField.get(defId) ){
                // printE( srcEntity.components[defId] );
                result.addComponent( entity.components[defId] );
            }
        }
    }
    
    return result;
}


export function hash( arr, asString ){
    return Utils.hash( 'EntityFilter' + JSON.stringify(arr), asString );
}


export function isEntityFilter( ef ){
    return ef && ef instanceof EntityFilter;
}

/**
*   Returns true if the srcBitField is acceptable against the bitfield and type
*/
export function accept( type, srcBitField, bitField, debug ){
    let bfCount, srcBitFieldCount;
    
    if( bitField ){
        bfCount = bitField.count();
    }
    type = parseInt( type, 10 );
    srcBitFieldCount = srcBitField.count();

    // log.debug('accept src> ' + JSON.stringify(srcBitField) );
    // log.debug('accept btf> ' + JSON.stringify(bitField) );
    
    switch( type ){
        case SOME:
            if( srcBitFieldCount === 0 ){ return false; }
            break;
        case NONE:
            if( bfCount === 0 || srcBitFieldCount === 0 ){ return true; }
            if( BitField.aand( bitField, srcBitField ) ){ return false; }
            break;

        case ANY:
            if( bfCount === 0 ){ return true; }
            if( srcBitFieldCount === 0 ){ return false; }
            if( !BitField.aand( bitField, srcBitField ) ){ return false; }
            break;
        case ALL:
            if( bfCount === 0 ){ return true; }
            // if( debug ){
            //     log.debug( bitField.toValues() );
            //     log.debug( srcBitField.toValues() );
            // }
            if( !BitField.and( bitField, srcBitField ) ){ return false; }
            break;
        default:
            break;
    }
    return true;
}




export function create( type, bitField ){
    let result = new EntityFilter();
    result.filters = {};
    if( type !== undefined ){ result.add(type,bitField); }
    return result;
}

export default EntityFilter;