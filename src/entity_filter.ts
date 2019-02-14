import { BitField } from 'odgn-bitfield';
import { arrayDifference } from './util/array/difference';
import { hash } from './util/hash';
import { isObject } from './util/is';

export const enum EntityFilterType {
    All = 'AL', // entities must have all the specified components
    Any = 'AN', // entities must have one or any of the specified components
    Some = 'SM', // entities must have at least one component
    None = 'NO', // entities should not have any of the specified components
    Include = 'IN', // the filter will only include specified components
    Exclude = 'EX', // the filter will exclude specified components
    Root = 'RT', // kind of a NO-OP
}


/**
 *
 */
export class EntityFilter {

    filters:Map<EntityFilterType,BitField> = new Map<EntityFilterType,BitField>();

    static create(type:object|EntityFilterType = EntityFilterType.All, bitField?:BitField) : EntityFilter {
        let result = new EntityFilter();
        
        if (type !== undefined) {
            result.add(type, bitField);
        }
    
        return result;
    }

    static isEntityFilter(ef: any): boolean {
        return ef && ef instanceof EntityFilter;
    }

    static Transform(type:EntityFilterType, registry, entity, entityBitField:BitField, filterBitField:BitField) {
        let ii, len, defID, vals, result;
        const isInclude = type == EntityFilterType.Include;
        const isExclude = type == EntityFilterType.Exclude;

        if (isInclude) {
            const removeDefIDs = arrayDifference(
                <Array<number>>entityBitField.toJSON(),
                <Array<number>>filterBitField.toJSON()
            );
            // log.debug('EFT ',type,isInclude, entityBitField.toJSON(), filterBitField.toJSON(), removeDefIDs );

            entity.removeComponents(removeDefIDs);

            return entity;

            // handle exclude filter, and also no filter specified
        } else {
            vals = entityBitField.toValues();
            for (ii = 0, len = vals.length; ii < len; ii++) {
                defID = vals[ii];
                if (!isExclude || !entityBitField.get(defID)) {
                    // printE( srcEntity.components[defID] );
                    result.addComponent(entity.components[defID]);
                }
            }
        }

        return result;
    }

    /**
     *   Returns true if the srcBitField is acceptable against the bitfield and type
     */
    static accept(type:EntityFilterType, srcBitField:BitField, bitField?:BitField, debug:boolean=false): boolean {
        let bfCount, srcBitFieldCount;

        if (bitField) {
            bfCount = bitField.count();
        }

        srcBitFieldCount = srcBitField.count();

        // console.log('[accept] src> ' + JSON.stringify(srcBitField), srcBitFieldCount );
        // console.log('[accept] btf> ' + JSON.stringify(bitField) );

        switch (type) {
            case EntityFilterType.Some:
                if (srcBitFieldCount === 0) {
                    return false;
                }
                break;
            case EntityFilterType.None:
                if (bfCount === 0 || srcBitFieldCount === 0) {
                    return true;
                }
                if (BitField.or(bitField, srcBitField)) {
                    return false;
                }
                break;

            case EntityFilterType.Any:
                if (bfCount === 0) {
                    return true;
                }
                if (srcBitFieldCount === 0) {
                    return false;
                }
                if (!BitField.or(bitField, srcBitField)) {
                    return false;
                }
                break;
            case EntityFilterType.All:
                if (bfCount === 0) {
                    return true;
                }
                if (srcBitFieldCount === 0) {
                    return false;
                }
                // // if( debug ){
                //     console.log( 'a', bitField.toValues() );
                //     console.log( 'b', srcBitField.toValues() );
                // // }

                // if (!BitField.or(bitField, srcBitField)) {
                //     return false;
                // }

                if (!BitField.and(bitField, srcBitField)) {
                    return false;
                }
                break;
            default:
                break;
        }
        return true;
    }

    

    /**
     *
     */
    add(type:EntityFilter|EntityFilterType|object, bitField?:BitField) {
        let existing;

        if (EntityFilter.isEntityFilter(type)) {
            let filter:EntityFilter = <EntityFilter>type;
            for( const [t,bf] of filter.filters ){
                this.add(t, bf);
            }
            return;
        } else if (isObject(type) && !bitField) {
            let keys = Object.keys(type);
            // being passed a serialised form of EntityFilter
            for( let ii=0;ii<keys.length;ii++ ){
                let key = <EntityFilterType>keys[ii];
                this.add( key, type[key] );
            }

            
            return;
        }

        if (Array.isArray(bitField)) {
            bitField = BitField.create(bitField);
        } else if (!bitField) {
            bitField = BitField.create();
        }
        if (!(existing = this.filters[<EntityFilterType>type])) {
            this.filters[<EntityFilterType>type] = bitField;
        } else {
            existing.set(bitField);
        }
    }

    /**
     *
     */
    getValues(index:EntityFilterType = EntityFilterType.All) : Array<number> {
        const filter:BitField = this.filters[index];
        return filter.toValues();
    }

    /**
     *
     */
    accept(entity, options) {
        let bitField;
        let ebf; // = BitField.isBitField(entity) ? entity : entity.getComponentBitfield();
        let registry = options ? options.registry : null;
        let type:EntityFilterType;

        if (BitField.isBitField(entity)) {
            ebf = entity;
            entity = true;
        } else {
            ebf = entity.getComponentBitfield();
        }

        // console.log('accept with filters', this.filters);

        this.filters.forEach( (bitfield, type) => {
            // log.debug('EF.accept ' + type + ' ', bitField.toJSON(), ebf.toJSON() );
            if (entity && type == EntityFilterType.Include) {
                // log.debug('EF.accept filter pre', toString( entity ));
                entity = EntityFilter.Transform(
                    type,
                    registry,
                    entity,
                    ebf,
                    bitField
                );
                // log.debug('EF.accept filter post', toString( entity ));
            } else if (!EntityFilter.accept(type, ebf, bitField, true)) {
                return null;
            }
        })

        return entity;
    }

    hash(asString) {
        return hash('EntityFilter' + JSON.stringify(this), asString);
    }

    toJSON() : object {
        let result = {};
        for (let type in this.filters) {
            result[type] = this.filters[type].toValues();
        }
        return result;
    }
}
