'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var BitField = require('./bit_field');
var Utils = require('./utils');
var Entity = require('./entity');

// var Stream = require('stream');
// var Transform = Stream.Transform || require('readable-stream').Transform;


EntityFilter.ALL = 0; // entities must have all the specified components
EntityFilter.ANY = 1; // entities must have one or any of the specified components
EntityFilter.SOME = 2; // entities must have at least one component
EntityFilter.NONE = 3; // entities should not have any of the specified components
EntityFilter.INCLUDE = 4; // the filter will only include specified components
EntityFilter.EXCLUDE = 5; // the filter will exclude specified components
EntityFilter.USER = 6; // a user defined function has been supplied
EntityFilter.ARRAY = 7;
EntityFilter.TypeString = [ 'all', 'any', 'some', 'none', 'include', 'exclude', 'user', 'array' ];



function EntityFilter(){
    this._filters = [];
}


_.extend( EntityFilter.prototype, Backbone.Events, {
    type: 'EntityFilter',
    isEntityFilter: true,

    add: function( type, bitField ){
        this._filters.push( {bf:bitField, type:type} );
    },

    at: function( index ){
        return this._filters[index];
    },

    size: function(){
        return this._filters.length;
    },

    /**
    *   
    */
    iterator: function( source, options ){
        var self = this;
        var sourceIterator = source.iterator();

        return {
            next: function(){
                var entity;
                var next;
                while( (entity = sourceIterator.next().value) ){
                    if( self.accept( entity ) ){
                        return { value:entity, done: false };
                    }
                }
                return {done:true};
            }
        }
    },

    // iterator: function( source ){
    //     var sourceIterator = source.iterator();
    //     throw new Error('not yet implemented');
    // },

    
    /**
    * Returns true if the passed entity is accepted
    */
    accept: function(entity, options){
        var i,len,result, filter;

        if( !entity ){
            return false;
        }
        
        for( i=0,len=this._filters.length;i<len;i++ ){
            filter = this._filters[i];
            if( !this.acceptEntity( entity, filter.type, filter.bf, null ) ){
                return false;
            }
        }
        return true;
    },

    acceptEntity: function( entity, type, bitField, extra, debug ){
        var ebf;
        var bfCount, ebfCount;
        ebf = entity.getComponentBitfield();
        // extra = options.extra;

        // extra componentDef - evaluated without
        // effecting the original bitfield
        if( extra ){
            ebf = ebf.clone();
            ebf.set( extra, true );
        }

        bfCount = bitField.count();
        ebfCount = ebf.count();
        
        switch( type ){
            case EntityFilter.SOME:
                if( ebfCount === 0 ){
                    return false;
                }
                break;
            case EntityFilter.NONE:
                if( bfCount === 0 || ebfCount === 0 ){
                    return true;
                }
                if( BitField.aand( bitField, ebf ) ){
                    return false;
                }
                break;

            case EntityFilter.ANY:
                if( bfCount === 0 ){
                    return true;
                }
                if( ebfCount === 0 ){
                    return false;
                }
                if( !BitField.aand( bitField, ebf ) ){
                    return false;
                }
                break;
            case EntityFilter.ALL:
                if( bfCount === 0 ){
                    return true;
                }
                if( debug ){
                    log.debug('bf ' + bitField.toValues() );
                    log.debug(entity.id + ' ebf ' + ebf.toValues() );
                }
                if( !BitField.and( bitField, ebf ) ){
                    return false;
                }
                break;
        }
        
        return true;
    },

    // _transform: function (entity, encoding, done) {

    // },

    /**
    * Takes an entity and passes it through the rule associated
    * with this filter.
    * The resultant entity is a (shallow) copy of the original, and may or
    * may not have the same components on
    */
    transform: function( entity, options ){
        var i,len,result, filter;
        var produceCopy = true; // a new entity with the same components is produced

        if( !this.accept(entity, options) ){
            return null;
        }

        // create another entity instance with the same id
        result = Entity.create( entity.id );

        for( i=0,len=this._filters.length;i<len;i++ ){
            filter = this._filters[i];
            result = this._transformEntity( entity, result, filter.type, filter.bf, null, false );
        }

        return result;        
    },

    _transformEntity: function( srcEntity, dstEntity, type, bitField, extra, debug ){
        var bf;
        var ebf;
        var vals;
        var result, i, len, defId;

        var isInclude = (type === EntityFilter.INCLUDE);
        var isExclude = (type === EntityFilter.EXCLUDE);

        vals = bitField.toValues();
        ebf = srcEntity.getComponentBitfield();

        // iterate through each of the values in our bitfield
        if( isInclude ){
            for( i=0,len=vals.length;i<len;i++ ){
                defId = vals[i];
                if( ebf.get(defId) ){
                    dstEntity.addComponent( srcEntity.components[defId] );
                }
            }
        // handle exclude filter, and also no filter specified
        } else {
            vals = ebf.toValues();
            for( i=0,len=vals.length;i<len;i++ ){
                defId = vals[i];
                if( !isExclude || !bitField.get(defId) ){
                    dstEntity.addComponent( srcEntity.components[defId] );
                }
            }
        }
        
        return dstEntity;
    },


    toArray: function(){
        var result = _.map( this._filters, function(filter){
            return [ filter.type ].concat( filter.bf.toValues() );
        });
        if( result.length === 1 ){
            return result[0];
        }
        return result;
    },

    hash: function(){
        var hash;
        _.each( this._filters, function(filter){
            hash += filter.type + JSON.stringify(filter.bf.toValues());
        });
        return Utils.hash( hash, true );
    },

    toString: function(){
        var typeString;
        var result = _.map( this._filters, function(filter){
            // if( this.type === EntityFilter.USER ){
            //     return EntityFilter.TypeString[ filter.type ] + ' `' + this.accept.toString() + '`';
            // }
            return EntityFilter.TypeString[ filter.type ] + ' ' + JSON.stringify(filter.bf.toValues());
        });

        if( result.length === 1 ){
            return result[0];
        }
        
        return result;
    }
});



EntityFilter.isEntityFilter = function( ef ){
    return ef && ef.isEntityFilter;// ( ef && _.isObject(ef) && ef instanceof EntityFilter );
}

EntityFilter.extend = Backbone.Model.extend;



/**
    Arguments supplied to this function can either be:

    - type, indeterimate number of component ids, options object
    - indeterminate number of arrays containing above, options object
    - accept function, options object
*/

EntityFilter.create = function( type, ids, options ){
    var i,len,cDefId;
    var args;
    var result;
    var userAcceptFn;

    var filters = [];

    // if the first argument is an array, then treat all the rest of the args the same
    args = Array.prototype.slice.call( arguments );
    type = args[args.length-1];

    if( _.isFunction(type) ){
        userAcceptFn = type;
        type = EntityFilter.USER;
    }
    // we have been passed an array of arguments
    else if( _.isArray(type) ){
        type = EntityFilter.ARRAY;
        filters = _.map( args, function(arr){
            if( _.isArray(arr) ){
                return arr;
            } else if( EntityFilter.isEntityFilter(arr) ){
                return arr.toArray();
            }
        });
    } else if( _.isObject(type) ){
        options = type;
        args.pop();
    } else {
        filters.push( args );
    }

    // if( _.isUndefined( type) ){
    //     throw new Error('undefined EntityFilter type');
    // }

    result = new EntityFilter();
    result.type = type;

    if( userAcceptFn ){
        result.accept = userAcceptFn;
    } else {
        result._filters = _.map( filters, function(args){
            var bitField = BitField.create();
            var type = args.shift();
            _.each( args, function(componentId){
                bitField.set( componentId, true );
            });
            return {bf:bitField, type:type};
        });
        if( filters.length === 1 ){
            result.type = result._filters[0].type;
        }
    }

    return result;
}

module.exports = EntityFilter;