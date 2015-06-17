'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var BitField = require('./bit_field');
var Utils = require('./utils');
var Entity = require('./entity');

// var Stream = require('stream');
// var Transform = Stream.Transform || require('readable-stream').Transform;

var EntityFilter = {};

EntityFilter.ALL = 0; // entities must have all the specified components
EntityFilter.ANY = 1; // entities must have one or any of the specified components
EntityFilter.SOME = 2; // entities must have at least one component
EntityFilter.NONE = 3; // entities should not have any of the specified components
EntityFilter.INCLUDE = 4; // the filter will only include specified components
EntityFilter.EXCLUDE = 5; // the filter will exclude specified components
// EntityFilter.USER = 6; // a user defined function has been supplied
// EntityFilter.ARRAY = 7;
// EntityFilter.ATTRIBUTES = 8; // entities must have components with the specified attributes
// EntityFilter.TypeString = [ 'all', 'any', 'some', 'none', 'include', 'exclude', 'user', 'array', 'attr' ];



// function EntityFilter(){
//     this._filters = [];
// }


// _.extend( EntityFilter.prototype, Backbone.Events, {
//     type: 'EntityFilter',
//     isEntityFilter: true,

//     /**
//     *   Adds a filter to this entity filter
//     *
//     */
//     add: function( type, bitField ){
//         var componentIId;
//         if( _.isFunction(type) ){
//             this._filters.push( {type: EntityFilter.USER, accept: type} );
//         } else if( EntityFilter.isEntityFilter(type) ){
//             this._filters = this._filters.concat( type._filters );
//         } else if( BitField.isBitField(bitField) ){
//             this._filters.push( {bf:bitField, type:type} );
//         } else {
//             // the bitField is either a component iid or an array of component iids
//             componentIId = _.isArray(bitField) ? bitField : [ bitField ];
//             bitField = BitField.create();
//             _.each( componentIId, function(componentId){
//                 bitField.set( componentId, true );
//             });
//             this._filters.push( {bf:bitField, type:type} );
//         }
//         return this;
//     },

//     at: function( index ){
//         return this._filters[index];
//     },

//     size: function(){
//         return this._filters.length;
//     },

//     /**
//     *   
//     */
//     iterator: function( source, options ){
//         var self = this;
//         var sourceIterator = source.iterator();

//         return {
//             next: function(){
//                 var entity;
//                 var next;
//                 while( (entity = sourceIterator.next().value) ){
//                     if( self.accept( entity ) ){
//                         return { value:entity, done: false };
//                     }
//                 }
//                 return {done:true};
//             }
//         }
//     },

//     // iterator: function( source ){
//     //     var sourceIterator = source.iterator();
//     //     throw new Error('not yet implemented');
//     // },

    
//     /**
//     * Returns true if the passed entity is accepted
//     */
//     accept: function(entity, options){
//         var i,len,result, filter;
//         var filterOptions = {};
//         if( !entity ){
//             return false;
//         }
        
//         for( i=0,len=this._filters.length;i<len;i++ ){
//             filter = this._filters[i];
//             if( filter.type === EntityFilter.USER ){
//                 if( !filter.accept( entity, filterOptions ) ){
//                     return false;
//                 }
//             }
//             else if( !this._acceptEntity( entity, filter.type, filter.bf, filter.attrs, filter.comIId, null ) ){
//                 return false;
//             }
//         }
//         return true;
//     },

//     _acceptEntity: function( entity, type, bitField, attrs, comIId, extra, debug ){
//         var ebf, key, com;
//         var bfCount, ebfCount;
        
//         if( !Entity.isEntity(entity) ){
//             throw new Error('invalid entity passed ' + JSON.stringify(entity) );
//         }
//         ebf = entity.getComponentBitfield();
//         // extra = options.extra;

//         // extra componentDef - evaluated without
//         // effecting the original bitfield
//         if( extra ){
//             ebf = ebf.clone();
//             ebf.set( extra, true );
//         }

//         bfCount = bitField.count();
//         ebfCount = ebf.count();
        
//         switch( type ){
//             case EntityFilter.SOME:
//                 if( ebfCount === 0 ){ return false; }
//                 break;
//             case EntityFilter.NONE:
//                 if( bfCount === 0 || ebfCount === 0 ){ return true; }
//                 if( BitField.aand( bitField, ebf ) ){ return false; }
//                 break;

//             case EntityFilter.ANY:
//                 if( bfCount === 0 ){ return true; }
//                 if( ebfCount === 0 ){ return false; }
//                 if( !BitField.aand( bitField, ebf ) ){ return false; }
//                 break;
//             case EntityFilter.ALL:
//                 if( bfCount === 0 ){ return true; }
//                 if( debug ){
//                     log.debug('bf ' + bitField.toValues() );
//                     log.debug(entity.id + ' ebf ' + ebf.toValues() );
//                 }
//                 if( !BitField.and( bitField, ebf ) ){ return false; }
//                 break;
//             case EntityFilter.ATTRIBUTES:
//                 com = entity.components[comIId];
//                 if( !com ){ return false; }
//                 for (key in attrs) {
//                     if (attrs[key] !== com.get(key)) { return false; }
//                 }
//                 // if( !BitField.and( bitField, ebf ) ){ return false; }
//                 break;
//         }
        
//         return true;
//     },

//     // _transform: function (entity, encoding, done) {

//     // },

//     /**
//     * Takes an entity and passes it through the rule associated
//     * with this filter.
//     * The resultant entity is a (shallow) copy of the original, and may or
//     * may not have the same components on
//     */
//     transform: function( entity, options ){
//         var i,len,result, filter;
//         var produceCopy = true; // a new entity with the same components is produced

//         if( !this.accept(entity, options) ){
//             return null;
//         }

//         // create another entity instance with the same id
//         result = Entity.create( entity.id );

//         len = this._filters.length;

//         if( len === 0 ){
//             result = this._transformEntity( entity, result, EntityFilter.ALL, null, null, false );
//         } else {
//             for( i=0,len;i<len;i++ ){
//                 filter = this._filters[i];
//                 if( filter.type === EntityFilter.USER ){
//                 } else {
//                     result = this._transformEntity( entity, result, filter.type, filter.bf, null, false );
//                 }
//             }
//         }

//         return result;        
//     },

//     _transformEntity: function( srcEntity, dstEntity, type, bitField, extra, debug ){
//         var bf, ebf, vals, isInclude, isExclude;
//         var result, i, len, defId;

//         isInclude = (type === EntityFilter.INCLUDE);
//         isExclude = (type === EntityFilter.EXCLUDE);

//         ebf = srcEntity.getComponentBitfield();

//         // iterate through each of the values in our bitfield
//         if( isInclude ){
//             vals = bitField.toValues();
//             for( i=0,len=vals.length;i<len;i++ ){
//                 defId = vals[i];
//                 if( ebf.get(defId) ){
//                     dstEntity.addComponent( srcEntity.components[defId] );
//                 }
//             }
//         // handle exclude filter, and also no filter specified
//         } else {
//             vals = ebf.toValues();
//             for( i=0,len=vals.length;i<len;i++ ){
//                 defId = vals[i];
//                 if( !isExclude || !bitField.get(defId) ){
//                     // printE( srcEntity.components[defId] );
//                     dstEntity.addComponent( srcEntity.components[defId] );
//                 }
//             }
//         }
        
//         return dstEntity;
//     },


//     toArray: function( asString ){
//         var result = _.map( this._filters, function(filter){
//             var type = asString ? EntityFilter.TypeString[ filter.type ] : filter.type;
//             var result = [ type, filter.bf.toValues() ];
//             if( filter.type === EntityFilter.ATTRIBUTES ){
//                 result = result.concat( filter.attrs );
//             }
//             else if( filter.type === EntityFilter.USER ){
//                 result = result.concat( this.accept.toString() );
//             }
//             return result;
//         });
//         if( result.length === 1 ){
//             return result[0];
//         }
//         return result;
//     },

//     // hash: function( asString ){
//     //     return Utils.hash( this.toString(), asString );
//     // },

//     toJSON: function(){
//         var result = _.map( this._filters, function(filter){
//             if( filter.type === EntityFilter.USER ){
//                 return {type:EntityFilter.TypeString[ filter.type ], accept:' `' + this.accept.toString() + '`'};
//             }
//             return {type:EntityFilter.TypeString[ filter.type ], bf:JSON.stringify(filter.bf.toValues())};
//         });

//         if( result.length === 1 ){
//             return result[0];
//         }

//         return result;
//     },

//     // toString: function(){
//     //     var typeString;
//     //     var result = _.map( this._filters, function(filter){
//     //         if( filter.type === EntityFilter.USER ){
//     //             return EntityFilter.TypeString[ filter.type ] + ' `' + filter.accept.toString() + '`';
//     //         }
//     //         return EntityFilter.TypeString[ filter.type ] + ' ' + JSON.stringify(filter.bf.toValues());
//     //     });


//     //     if( result.length === 1 ){
//     //         return result[0];
//     //     }
        
//     //     return result.join(';');
//     // }
// });

// EntityFilter.hash = function( arr, asString ){
//     if( EntityFilter.isEntityFilter(arr) ){
//         arr = arr.toArray();
//         return Utils.hash( 'EntityFilter' + JSON.stringify(arr), asString );
//     } else if( _.isArray(arr) ){
//         return Utils.hash( 'EntityFilter' + JSON.stringify(arr), asString );
//     }
//     if( _.isUndefined(asString) ){
//         return "";
//     }
//     return asString ? "" : 0;
// }


// EntityFilter.isEntityFilter = function( ef ){
//     return ef && ef.isEntityFilter;
// }

// EntityFilter.extend = Backbone.Model.extend;




/**
*   Returns true if the srcBitField is acceptable against the bitfield and type
*/
EntityFilter.accept = function( type, srcBitField, bitField, debug ){
    var bfCount, srcBitFieldCount;
    
    if( bitField ){
        bfCount = bitField.count();
    }
    srcBitFieldCount = srcBitField.count();

    // log.debug('accept src> ' + JSON.stringify(srcBitField) );
    // log.debug('accept btf> ' + JSON.stringify(bitField) );
    
    switch( type ){
        case EntityFilter.SOME:
            if( srcBitFieldCount === 0 ){ return false; }
            break;
        case EntityFilter.NONE:
            if( bfCount === 0 || srcBitFieldCount === 0 ){ return true; }
            if( BitField.aand( bitField, srcBitField ) ){ return false; }
            break;

        case EntityFilter.ANY:
            if( bfCount === 0 ){ return true; }
            if( srcBitFieldCount === 0 ){ return false; }
            if( !BitField.aand( bitField, srcBitField ) ){ return false; }
            break;
        case EntityFilter.ALL:
            if( bfCount === 0 ){ return true; }
            // if( debug ){
            //     log.debug('bf ' + bitField.toValues() );
            //     log.debug(entity.id + ' srcBitField ' + srcBitField.toValues() );
            // }
            if( !BitField.and( bitField, srcBitField ) ){ return false; }
            break;
    }
    
    return true;
}



// /**
//     Arguments supplied to this function can either be:

//     - type, indeterimate number of component ids, options object
//     - indeterminate number of arrays containing above, options object
//     - accept function, options object
// */

// EntityFilter.create = function( type, ids, attrs, options ){
//     var i,len,cDefId;
//     var args, result, userAcceptFn;

//     var filters = [];

//     result = new EntityFilter();

//     // if the first argument is an array, then treat all the rest of the args the same
//     if( _.isFunction(type) ){
//         result.add( type );
//         return result;
//     }
//     // we have been passed an array of arguments
//     else if( _.isArray(type) ){
//         filters = _.map( type, function(arr){
//             if( _.isArray(arr) || _.isFunction(arr) ){
//                 return arr;
//             } else if( EntityFilter.isEntityFilter(arr) ){
//                 return arr.toArray();
//             }
//         });
//         if( _.isObject(ids) ){
//             options = ids;
//         }
//         type = EntityFilter.ARRAY;
//     } else {
//         if( arguments.length > 0 ){
//             filters.push( [type,ids,attrs] );
//         }
//     }

//     result._filters = _.map( filters, function(args){
//         var attrs, type, bitField, result;


//         if( _.isFunction(args) ){
//             return {accept:args, type:EntityFilter.USER};
//         }

//         bitField = BitField.create();
//         result = {bf:bitField, type:(type = args.shift())};

//         if( type === EntityFilter.ATTRIBUTES ){
//             if( _.isObject(args[args.length-1]) ){
//                 result.attrs = args.pop();
//                 result.comIId = args[0];
//             }
//         }

//         _.each( _.isArray(args[0])?args[0]:[args[0]], function(componentId){
//             bitField.set( componentId, true );
//         });
//         return result;
//     });

//     return result;
// }

module.exports = EntityFilter;