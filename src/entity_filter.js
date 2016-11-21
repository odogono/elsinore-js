import _ from 'underscore';
import BitField  from 'odgn-bitfield';
import Entity from './entity';
import {
    hash
} from './util';

export const ALL = 0; // entities must have all the specified components
export const ANY = 1; // entities must have one or any of the specified components
export const SOME = 2; // entities must have at least one component
export const NONE = 3; // entities should not have any of the specified components
export const INCLUDE = 4; // the filter will only include specified components
export const EXCLUDE = 5; // the filter will exclude specified components
export const ROOT = 6; // kind of a NO-OP


/**
 * 
 */
export default class EntityFilter {

    constructor( type, bitfield ){
        this.filters = {};
        if( !_.isUndefined(type) ){
            this.add(type,bitfield);
        }
    }

    /**
     * 
     */
    add( type, bitField ){
        let existing;
        if( EntityFilter.isEntityFilter(type) ){
            for (let t in type.filters) {
                this.add( t, type.filters[t] );
            }
            return;
        } else if( _.isObject(type) && !bitField ){
            // being passed a serialised form of EntityFilter
            _.each( type, (bf,type) => {
                type = parseInt(type,10);
                this.add( type, bf );
            })
            return;
        }

        if( _.isArray(bitField) ){
            bitField = BitField.create(bitField);
        } else if( !bitField ){
            bitField = BitField.create();
        }
        if( !(existing = this.filters[type]) ){
            this.filters[type] = bitField;
        } else {
            existing.set( bitField );
        }
    }

    /**
     * 
     */
    getValues(index){
        const filter = this.filters[index || ALL ];
        return filter.toValues();
    }

    /**
     * 
     */
    accept( entity, options ){
        let filter, bitField;
        let ebf;// = BitField.isBitField(entity) ? entity : entity.getComponentBitfield();
        let registry = options ? options.registry : null;

        if( BitField.isBitField(entity) ){
            ebf = entity;
            entity = true;
        } else {
            ebf = entity.getComponentBitfield();
        }

        // console.log('accept with filters', this.filters);

        for (let type in this.filters) {
            bitField = this.filters[type];
            // log.debug('EF.accept ' + type + ' ', bitField.toJSON(), ebf.toJSON() );
            if( entity && type == INCLUDE ){
                
                // log.debug('EF.accept filter pre', toString( entity ));
                entity = EntityFilter.Transform( type, registry, entity, ebf, bitField );
                // log.debug('EF.accept filter post', toString( entity ));
            }
            else if( !EntityFilter.accept( type, ebf, bitField, true ) ){
                return null;
            }
        }
        return entity;
    }

    hash( asString ){
        return hash( 'EntityFilter' + JSON.stringify(this), asString );
    }

    toJSON(){
        let bitField, result = {};
        for (let type in this.filters) {
            result[type] = this.filters[type].toValues();
        }
        return result;
    }

}

EntityFilter.ALL = ALL;
EntityFilter.ANY = ANY;
EntityFilter.SOME = SOME;
EntityFilter.NONE = NONE;
EntityFilter.INCLUDE = INCLUDE;
EntityFilter.EXCLUDE = EXCLUDE;
EntityFilter.ROOT = ROOT;


EntityFilter.Transform = function( type, registry, entity, entityBitField, filterBitField ){
    let ii, len, defId, bf, ebf, vals, result;
    const isInclude = (type == INCLUDE);
    const isExclude = (type == EXCLUDE);

    // result = registry.cloneEntity(entity);

    if( isInclude ){
        const removeDefIds = _.difference(entityBitField.toJSON(), filterBitField.toJSON());
        // log.debug('EFT ',type,isInclude, entityBitField.toJSON(), filterBitField.toJSON(), removeDefIds );

        entity.removeComponents( removeDefIds );
        
        return entity;

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


// export function hash( arr, asString ){
//     return hash( 'EntityFilter' + JSON.stringify(arr), asString );
// }


EntityFilter.isEntityFilter = function isEntityFilter( ef ){
    return ef && ef instanceof EntityFilter;
}

/**
*   Returns true if the srcBitField is acceptable against the bitfield and type
*/
EntityFilter.accept = function( type, srcBitField, bitField, debug ){
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


// export function create( type, bitField ){
//     let result = new EntityFilter();
//     result.filters = {};
//     // console.log('EntityFilter.create', type, bitField);
//     if( type !== undefined ){ result.add(type,bitField); }
//     return result;
// }

// export default EntityFilter;