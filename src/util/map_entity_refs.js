import {cloneComponent} from './clone';


/**
*   Updates any entity references on a component instance
*
*   Takes the supplied entityIDMap and converts any component
*   properties that have been marked as entity refs.
*
*   The returned component is a clone of the original
*
*   TODO: determine whether this belongs here. this could be moved out
*   to a module by itself, or perhaps become a processor
*/
export function mapComponentEntityRefs( registry, component, entityIDMap, options ){
    let name,property, val, updates;
    let result;
    // let properties;

    if( !entityIDMap || Object.keys(entityIDMap).length === 0 ){
        return component;
    }

    // console.log('getting com def', component.getDefUri() );
    const componentDef = registry.schemaRegistry.getComponentDef( component.getDefUri() );
    const componentProperties = componentDef.getProperties();
    // properties = getProperties( registry.schemaRegistry, component.getSchemaUri() );


    if( !componentProperties ){
        return component;
    }

    result = cloneComponent(component);
    
    updates = {};

    for( name in componentProperties ){
        property = componentProperties[name];
        if( property.type == 'eref' || (property.type == 'integer' && property.format == 'entity') ){
            if( (val = component.get(name)) !== undefined ){
                if( entityIDMap.hasOwnProperty(val.toString()) ){
                    updates[ name ] = entityIDMap[ val ];
                }
            }
        }
    }

    result.set( updates );

    return result;
}