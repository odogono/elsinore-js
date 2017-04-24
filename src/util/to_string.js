import {Collection} from 'odgn-backbone-model';

import Component from '../component';
import Entity from '../entity';
import EntitySet from '../entity_set';
import EntityProcessor from '../entity_processor';
import stringify from './stringify';

import { getEntityIdFromId } from './id'

export function entityToString(entity, indent){
    let res = [];
    let comDefId;
    
    indent || (indent='');
    res.push( indent + 
        '- ' + entity.cid 
        + ' (' + entity.getEntityId() + '/' + entity.getEntitySetId() + ')' 
        + ' ' + entity.hash(true)
        );

    indent += '  ';
    
    for( comDefId in entity.components ){
        res.push( componentToString( entity.components[comDefId], indent) );
    }
    return res;
}

export function componentToString(component, indent=''){
    let componentJSON;

    if( !component ){
        return;
    }
    
    componentJSON = stringify(component);
    const cCid = component.cid;
    const componentId = component.id || 0;
    const cDefId = component.getDefId();
    const cName = component.name;
    const entityId = getEntityIdFromId(component.getEntityId());
    const componentHash = component.hash(true);

    return `${indent}${cCid} (${componentId}) ${cName}(${cDefId}) e:${entityId} ${componentHash} ${componentJSON}`;
}

export function entitySetToString(es, indent){
    let entity;
    let res = [];
    let it;
    
    it = es.iterator();
    indent || (indent='');
    res.push( indent + '- ' + es.cid + ' (' + es.id + ') ' + es.getUUID() )
    indent = indent + '  ';
    
    if( es.entityFilters ){
        es.entityFilters.forEach( ef => res.push( indent + 'ef( ' + ef.toString() + ' )') );
    }
    
    while( (entity = it.next().value) ){
        res = res.concat( entityToString(entity, indent) );
    }

    return res;
}

export function toString(entity, indent='', join="\n"){
    let res = [''];
    
    if( Array.isArray(entity) ){
        entity.forEach( e => res = res.concat( toString(e,'  ', ' ')));
    }
    else if( Entity.isEntity(entity) ){
        res = res.concat( entityToString(entity,indent) );
    } else if( Component.isComponent(entity) ){
        res = res.concat( componentToString(entity,indent) );
    } else if( EntityProcessor.isEntityProcessor(entity) ){
        res = res.concat( entitySetToString( entity.entitySet, indent ) );
    } else if( EntitySet.isEntitySet(entity) ){
        res = res.concat( entitySetToString( entity, indent ) );
    } else if( entity instanceof Collection ){
        entity.each( item => {
            res = res.concat( toString(item,'  ') );
        });
    }
    return res.join(join);
}

export function secretToString(entity, indent='', join="\n"){
    let res = [''];
    
    if( Array.isArray(entity) ){
        entity.forEach( e => res = res.concat( toString(e,'  ', ' ' ) ))
    }
    else if( Entity.isEntity(entity) ){
        res = res.concat( entityToString(entity,indent) );
    } else if( Component.isComponent(entity) ){
        res = res.concat( componentToString(entity,indent) );
    } else if( EntityProcessor.isEntityProcessor(entity) ){
        res = res.concat( entitySetToString( entity.entitySet, indent ) );
    } else if( EntitySet.isEntitySet(entity) ){
        res = res.concat( entitySetToString( entity, indent ) );
    } else if( entity instanceof Collection ){
        entity.each( item => {
            res = res.concat( toString(item,'  ') );
        });
    }
    return res.join(join);
}