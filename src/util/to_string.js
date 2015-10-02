import _ from 'underscore';
import Backbone from 'backbone';

import Component from '../component';
import Entity from '../entity';
import EntitySet from '../entity_set';
import EntityProcessor from '../entity_processor';

import { stringify, getEntityIdFromId } from './index'

function entityToString(entity, indent){
    var res = [];
    var comDefId;
    
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

function componentToString(component, indent){
    var componentJSON;
    indent || (indent='');

    if( !component ){
        return;
    }

    
    componentJSON = stringify(component);
    

    return indent 
        + '' + component.cid 
        + ' (' + (component.id || '0') +') '
        + component.name 
        + '(' + component.getSchemaId() + ')'
        + ' e:' + getEntityIdFromId(component.getEntityId()) + '' 
        + ' ' + component.hash(true)
        + ' ' + componentJSON;
}

function entitySetToString(es, indent){
    var entity;
    var res = [];
    var it;
    
    it = es.iterator();
    indent || (indent='');
    res.push( indent + '- ' + es.cid + ' (' + es.id + ')' )
    indent = indent + '  ';
    
    if( es.entityFilters ){
        _.each( es.entityFilters, function(ef){
            res.push( indent + 'ef( ' + ef.toString() + ' )');    
        });
    }
    
    while( (entity = it.next().value) ){
        res = res.concat( entityToString(entity, indent) );
    }

    return res;
}

function toString(entity, indent, join){
    var res = [''];
    var e;
    indent || (indent='');
    join || (join="\n");
    if( _.isArray(entity) ){
        _.each( entity, function(e){
            res = res.concat( toString(e,'  ', ' ' ) );
        });
    }
    else if( Entity.isEntity(entity) ){
        res = res.concat( entityToString(entity,indent) );
    } else if( Component.isComponent(entity) ){
        res = res.concat( componentToString(entity,indent) );
    } else if( EntityProcessor.isEntityProcessor(entity) ){
        res = res.concat( entitySetToString( entity.entitySet, indent ) );
    } else if( EntitySet.isEntitySet(entity) ){
        res = res.concat( entitySetToString( entity, indent ) );
    } else if( entity instanceof Backbone.Collection ){
        entity.each( function(item){
            res = res.concat( toString(item,'  ') );
        });
    }
    return res.join(join);
}

module.exports = {
    toString: toString,
    entitySetToString: entitySetToString,
    componentToString: componentToString,
    entityToString: entityToString
};