import _ from 'underscore';
import {copyComponent} from './copy';
import {getProperties} from '../schema/properties';


/**
*   Updates any entity references on a component instance
*
*   Takes the supplied entityIdMap and converts any component
*   properties that have been marked as entity refs.
*
*   The returned component is a clone of the original
*
*   TODO: determine whether this belongs here. this could be moved out
*   to a module by itself, or perhaps become a processor
*/
export default function mapComponentEntityRefs( registry, component, entityIdMap, options ){
    let ii,len, property, val, updates;
    let result;
    let properties;

    if( !entityIdMap || _.size(entityIdMap) === 0 ){
        return component;
    }

    properties = getProperties( registry.schemaRegistry, component.schemaUri );

    if( !properties ){
        return component;
    }

    result = copyComponent( registry, component );
    
    updates = {};

    for( ii=0,len=properties.length;ii<len;ii++ ){
        property = properties[ii];
        if( property.type == 'eref' || (property.type == 'integer' && property.format == 'entity') ){
            if( (val = component.get(property.name)) !== undefined ){
                if( entityIdMap.hasOwnProperty(val.toString()) ){
                    updates[ property.name ] = entityIdMap[ val ];
                }
            }
        }
    }

    result.set( updates );

    return result;
}
