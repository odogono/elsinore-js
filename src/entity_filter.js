import BitField from 'odgn-bitfield';

import { arrayDifference } from './util/array/difference';
import { isObject } from './util/is';
import { hash } from './util/hash';

export const ALL = 'AL'; // entities must have all the specified components
export const ANY = 'AN'; // entities must have one or any of the specified components
export const SOME = 'SM'; // entities must have at least one component
export const NONE = 'NO'; // entities should not have any of the specified components
export const INCLUDE = 'IN'; // the filter will only include specified components
export const EXCLUDE = 'EX'; // the filter will exclude specified components
export const ROOT = 'RT'; // kind of a NO-OP

/**
 *
 */
export function EntityFilter() {}

Object.assign(EntityFilter.prototype, {
    /**
     *
     */
    add(type, bitField) {
        let existing;
        if (EntityFilter.isEntityFilter(type)) {
            for (let t in type.filters) {
                this.add(t, type.filters[t]);
            }
            return;
        } else if (isObject(type) && !bitField) {
            // being passed a serialised form of EntityFilter
            for (let ftype in type) {
                this.add(ftype, type[ftype]);
            }
            return;
        }

        if (Array.isArray(bitField)) {
            bitField = BitField.create(bitField);
        } else if (!bitField) {
            bitField = BitField.create();
        }
        if (!(existing = this.filters[type])) {
            this.filters[type] = bitField;
        } else {
            existing.set(bitField);
        }
    },

    /**
     *
     */
    getValues(index) {
        const filter = this.filters[index || ALL];
        return filter.toValues();
    },

    /**
     *
     */
    accept(entity, options) {
        let bitField;
        let ebf; // = BitField.isBitField(entity) ? entity : entity.getComponentBitfield();
        let registry = options ? options.registry : null;

        if (BitField.isBitField(entity)) {
            ebf = entity;
            entity = true;
        } else {
            ebf = entity.getComponentBitfield();
        }

        // console.log('accept with filters', this.filters);

        for (let type in this.filters) {
            bitField = this.filters[type];
            // log.debug('EF.accept ' + type + ' ', bitField.toJSON(), ebf.toJSON() );
            if (entity && type == INCLUDE) {
                // log.debug('EF.accept filter pre', toString( entity ));
                entity = EntityFilter.Transform(type, registry, entity, ebf, bitField);
                // log.debug('EF.accept filter post', toString( entity ));
            } else if (!EntityFilter.accept(type, ebf, bitField, true)) {
                return null;
            }
        }
        return entity;
    },

    hash(asString) {
        return hash('EntityFilter' + JSON.stringify(this), asString);
    },

    toJSON() {
        let result = {};
        for (let type in this.filters) {
            result[type] = this.filters[type].toValues();
        }
        return result;
    }
});

EntityFilter.Transform = function(type, registry, entity, entityBitField, filterBitField) {
    let ii, len, defId, vals, result;
    const isInclude = type == INCLUDE;
    const isExclude = type == EXCLUDE;

    // result = registry.cloneEntity(entity);

    if (isInclude) {
        const removeDefIds = arrayDifference(entityBitField.toJSON(), filterBitField.toJSON());
        // log.debug('EFT ',type,isInclude, entityBitField.toJSON(), filterBitField.toJSON(), removeDefIds );

        entity.removeComponents(removeDefIds);

        return entity;

        // handle exclude filter, and also no filter specified
    } else {
        vals = entityBitField.toValues();
        for (ii = 0, len = vals.length; ii < len; ii++) {
            defId = vals[ii];
            if (!isExclude || !bitField.get(defId)) {
                // printE( srcEntity.components[defId] );
                result.addComponent(entity.components[defId]);
            }
        }
    }

    return result;
};

// export function hash( arr, asString ){
//     return hash( 'EntityFilter' + JSON.stringify(arr), asString );
// }

EntityFilter.isEntityFilter = function isEntityFilter(ef) {
    return ef && ef instanceof EntityFilter;
};

/**
 *   Returns true if the srcBitField is acceptable against the bitfield and type
 */
EntityFilter.accept = function(type, srcBitField, bitField, debug) {
    let bfCount, srcBitFieldCount;

    if (bitField) {
        bfCount = bitField.count();
    }

    srcBitFieldCount = srcBitField.count();

    // console.log('[accept] src> ' + JSON.stringify(srcBitField), srcBitFieldCount );
    // console.log('[accept] btf> ' + JSON.stringify(bitField) );

    switch (type) {
        case SOME:
            if (srcBitFieldCount === 0) {
                return false;
            }
            break;
        case NONE:
            if (bfCount === 0 || srcBitFieldCount === 0) {
                return true;
            }
            if (BitField.aand(bitField, srcBitField)) {
                return false;
            }
            break;

        case ANY:
            if (bfCount === 0) {
                return true;
            }
            if (srcBitFieldCount === 0) {
                return false;
            }
            if (!BitField.aand(bitField, srcBitField)) {
                return false;
            }
            break;
        case ALL:
            if (bfCount === 0) {
                return true;
            }
            // if( debug ){
            //     log.debug( bitField.toValues() );
            //     log.debug( srcBitField.toValues() );
            // }
            if (!BitField.and(bitField, srcBitField)) {
                return false;
            }
            break;
        default:
            break;
    }
    return true;
};

EntityFilter.create = function(type, bitField) {
    let result = new EntityFilter();
    result.filters = {};
    if (type !== undefined) {
        result.add(type, bitField);
    }

    return result;
};
