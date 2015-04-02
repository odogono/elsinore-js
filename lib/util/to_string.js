'use strict';

var _ = require('underscore');

var Elsinore = require('../index');

var Component = Elsinore.Component;
var Entity = Elsinore.Entity;
var EntitySet = Elsinore.EntitySet;
var EntityProcessor = Elsinore.EntityProcessor;
var Utils = require('../utils');

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

    
    componentJSON = Utils.stringify(component);
    

    return indent 
        + '' + component.cid 
        + ' c:' + component.name 
        + '(' + component.schemaIId + ')'
        + ' e:' + component.getEntityId()// + '/' + component.get('_ei')
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