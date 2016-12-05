import _ from 'underscore';
import Query from './index';
import EntitySet from '../entity_set';

import {register,
    LEFT_PAREN,
    RIGHT_PAREN,
    VALUE} from './index';

export const ATTR = 'AT';

/**
 * 
 */
function dslAttr(attr){
    const context = this.readContext( this );
    context.pushVal( [ATTR,attr] );
    return context;
}

/**
*   Takes the attribute value of the given component and returns it
*
*   This command operates on the single entity within context.
*/
function commandAttr( context, attributes ){
    let ii,jj,len,jlen,result;
    let entity = context.entity;
    let debug = context.debug;
    const componentIds = context.componentIds;

    // printIns( context,1 );
    // if( debug ){ console.log('ATTR> ' + stringify(componentIds) + ' ' + stringify( _.rest(arguments))  ); } 

    // if( !componentIds ){
    //     throw new Error('no componentIds in context');
    // }
    
    if( !entity ){
        console.log('ATTR> no entity');
        return (context.last = [ VALUE, null ] );
    }

    attributes = _.isArray( attributes ) ? attributes : [attributes];
    // components = entity.components;
    result = [];

    const components = entity.getComponents(componentIds);

    // console.log('commandComponentAttribute', attributes);    
    for( ii=0,len=components.length;ii<len;ii++ ){
        const component = components[ii];
        for(jj=0, jlen=attributes.length;jj<jlen;jj++ ){
            const attr = attributes[jj];
            const val = component.get(attr);
            if( val !== undefined ){
                result.push(val);
            }
        }
    }

    if( result.length === 0 ){
        result = null;
    } else if( result.length === 1 ){
        result = result[0];
    }

    return (context.last = [ VALUE, result ] );
}


register(ATTR, commandAttr, {attr:dslAttr} );