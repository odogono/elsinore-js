import _ from 'underscore';
import {register,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE} from './index';
import Query from './index';
import EntitySet from '../entity_set';


const PLUCK = 'PL';


/**
 * Adds pluck functionality directory to entityset
 */
EntitySet.prototype.pluck = function( componentIds, attr ){
    const query = new Query( Q => Q.pluck(componentIds,attr) );
    return query.execute(this);
}


function dslPluck( componentIds, property, options ){
    const context = this.readContext(this);

    context.pushOp( PLUCK );

    context.pushVal( LEFT_PAREN );

    context.pushVal( componentIds, true );
    
    context.pushVal( property, true );
    
    if( options ){
        // log.debug('adding options ' + options);
        context.pushVal( options, true );
    }

    context.pushVal( RIGHT_PAREN );
    
    return context;
}

/**
*   Returns the attribute values of specified components in the specified
*   entitySet 
*/
function commandPluck( context, componentIds, attributes, options ){
    // resolve the components to ids
    let result;
    let entitySet;

    // if( true ){ log.debug('pluck> ' + stringify(_.rest(arguments))); } 

    attributes = context.valueOf(attributes, true );
    attributes = Array.isArray( attributes ) ? attributes : [attributes];
    options = context.valueOf(options, true );
    
    entitySet = context.resolveEntitySet();

    // resolve the component ids
    // componentIds = context.valueOf(componentIds,true);
    // if( componentIds ){
    //     componentIds = context.registry.getIId( componentIds, true );
    // }

    result = pluckEntitySet( context.registry, entitySet, componentIds, attributes );
    
    if( options && options.unique ){
        result = _.uniq( result );
    }

    return (context.last = [VALUE, result]);
}


function pluckEntitySet( registry, entitySet, componentIds, attributes ){
    let result;

    // iterate through each of the entityset models and select the components
    // specified - if they exist, select the attributes required.
    result = _.reduce( entitySet.models, (values, entity) => {
        
        // log.debug('inCOMing ' + stringify(entity), attributes, componentIds );
        if( !componentIds ){
            // if there are no componentIds, then the type of attribute we can pluck is limited...
            _.each( attributes, attr => {
                if( attr == '@e' ){ values.push( entity.getEntityId() ); }
            });    
        } else {
            // const components = entity.getComponents(componentIds);

            _.each( entity.getComponents(componentIds), (component) => {
                // log.debug('inCOMing ' + stringify(component) );
                _.each( attributes, (attr) => {
                    if( attr == '@e' ){
                        values.push( entity.getEntityId() );
                    } else {
                        let val = component.get.call( component, attr );
                        if( val ) { values.push( val ); }
                    }
                });
            });
        }

        return values;
    }, []);

    return result;
}



/**
 * 
 */
function compile( context, command ){
    if( command[1] ){
        const resolved = context.valueOf( command[1], true );
        if( resolved ){
            command[1] = context.registry.getIId(resolved,true); 
        }
        else {
            command[1] = null;
        }
        // command[1] = context.resolveComponentIIds( command[1] );
        // console.log('pluck> resolve', command, resolved);
    }
    
    return command;
}


register(PLUCK, commandPluck, {pluck:dslPluck}, {compile} );
