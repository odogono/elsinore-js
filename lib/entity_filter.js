'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var BitField = require('./bit_field');
var Utils = require('./utils');
var Entity = require('./entity');

// var Stream = require('stream');
// var Transform = Stream.Transform || require('readable-stream').Transform;

function EntityFilter( type, options ){
    // allow use without new
    // if (!(this instanceof EntityFilter)) {
    //     return EntityFilter.create(type, options);
    // }

    options || (options={});
    // options.objectMode = true;
    // Transform.call(this, options);

    this.bitField = BitField.create();
    this.type = type || EntityFilter.ALL;
    this.options = options;
}

// EntityFilter.prototype._transform = function( entity, encoding, cb){
//     this.push( entity );
//     return cb();
// };

_.extend( EntityFilter.prototype, Backbone.Events, {

    // /**
    // *   Sets the next entity filter which should be
    // *   evaluated after this one
    // */
    // setNext: function( entityFilter ){
    //     var filterType;
    //     if( EntityFilter.isEntityFilter( entityFilter ) ){
    //         this.next = entityFilter;
    //     } else {
    //         var args = Array.prototype.slice.call( arguments );
    //         filterType = args[0];
    //     }

    //     return this.next;
    // },

    /**
    * Returns true if the passed entity is accepted
    */
    accept: function(entity, options){
        var i,len,result;
        var extra,bf,ebf,bfCount,ebfCount;
        options || (options = {});
        
        bf = this.bitField;
        ebf = entity.getComponentBitfield();
        extra = options.extra;

        // extra componentDef - evaluated without
        // effecting the original bitfield
        if( extra ){
            ebf = ebf.clone();
            ebf.set( extra, true );
        }

        bfCount = bf.count();
        ebfCount = ebf.count();
        
        switch( this.type ){
            case EntityFilter.SOME:
                if( ebfCount == 0 ){
                    return false;
                }
                break;
            case EntityFilter.NONE:
                if( bfCount == 0 || ebfCount == 0 )
                    return true;
                if( BitField.aand( bf, ebf ) ){
                    return false;
                }
                break;

            case EntityFilter.ANY:
                if( bfCount == 0 )
                    return true;
                if( ebfCount == 0 )
                    return false;
                if( !BitField.aand( bf, ebf ) ){
                    return false;
                }
                break;
            case EntityFilter.ALL:
                if( bfCount == 0 )
                    return true;
                if( options.debug ){
                    log.debug('bf ' + bf.toValues() );
                    log.debug(entity.id + ' ebf ' + ebf.toValues() );
                }
                if( !BitField.and( bf, ebf ) ){
                    return false;
                }
                break;
        }
        // if( this.next ){
        //     return this.next.accept(entity,options);
        // }
        return true;
    },

    _transform: function (entity, encoding, done) {

    },

    /**
    * Takes an entity and passes it through the rule associated
    * with this filter.
    * The resultant entity is a (shallow) copy of the original, and may or
    * may not have the same components on
    */
    transform: function( entity, options ){
        var result, i, len, defId, vals=this._values;
        var produceCopy = true; // a new entity with the same components is produced
        var bf;
        var ebf;
        var isInclude = (this.type === EntityFilter.INCLUDE);
        var isExclude = (this.type === EntityFilter.EXCLUDE);

        if( !this.accept(entity,options) ){
            return null;
        }

        result = Entity.create( entity.id );

        bf = this.bitField;
        ebf = entity.getComponentBitfield();

        // iterate through each of the values in our bitfield
        if( isInclude ){
            for( i=0,len=vals.length;i<len;i++ ){
                defId = vals[i];
                if( ebf.get(defId) ){
                    result.addComponent( entity.components[defId] );
                }
            }
        // handle exclude filter, and also no filter specified
        } else {// if( isExclude ){
            vals = ebf.toValues();
            for( i=0,len=vals.length;i<len;i++ ){
                defId = vals[i];
                if( !isExclude || !bf.get(defId) ){
                    result.addComponent( entity.components[defId] );
                }
            }
        }
        
        if( this.next ){
            return this.next.transform(entity,options);
        }

        // this.trigger('readable', result);
        return result;
    },

    toString: function(){
        var typeString;
        var result;
        // switch( this.type ){
        //     case EntityFilter.ALL: typeString = 'all'; break;
        //     case EntityFilter.ANY: typeString = 'any'; break;
        //     case EntityFilter.SOME: typeString = 'some'; break;
        //     case EntityFilter.NONE: typeString = 'none'; break;
        //     case EntityFilter.INCLUDE: typeString = 'include'; break;
        //     case EntityFilter.EXCLUDE: typeString = 'exclude'; break;
        //     default: break;
        // }
        result = EntityFilter.TypeString[ this.type ] + ' ' + JSON.stringify(this.bitField.toValues());
        if( this.next ){
            result = result + ' -> ' + this.next.toString();
        }
        return result;
    }
});

EntityFilter.ALL = 0; // entities must have all the specified components
EntityFilter.ANY = 1; // entities must have one or any of the specified components
EntityFilter.SOME = 2; // entities must have at least one component
EntityFilter.NONE = 3; // entities should not have any of the specified components
EntityFilter.INCLUDE = 4; // the filter will only include specified components
EntityFilter.EXCLUDE = 5; // the filter will exclude specified components

EntityFilter.TypeString = [ 'all', 'any', 'some', 'none', 'include', 'exclude' ];

// EntityFilter.prototype.__defineGetter__("next", function(){
//     return this._next;
// });

// EntityFilter.prototype.__defineSetter__("next", function(entityFilter){
//     this._next = entityFilter;
//     return entityFilter;
// });

EntityFilter.isEntityFilter = function( ef ){
    return ( ef && _.isObject(ef) && ef instanceof EntityFilter );
}

EntityFilter.extend = Backbone.Model.extend;

EntityFilter.create = function( type, ids, options ){
    var i,len,cDefId;
    var args;
    var result;

    // we have been passed an array of arguments
    if( _.isArray(type) ){
        result = [];
        for(i=0,len=type.length;i<len;i++){
            if( EntityFilter.isEntityFilter(type[i]) ){
                result.push( type[i] );
            }
            else {
                result.push( EntityFilter.create.apply( null, type[i] ) );
            }
        }
        return result;
    }

    result = new EntityFilter( type );

    if( _.isArray(ids) ){
        args = ids;
        options || (options={});
    } else {
        args = Array.prototype.slice.call( arguments, 1 );
        if( _.isObject(args[args.length-1]) ){
            options = args.pop();
        } else {
            options = {};
        }
    }

    for( i=0,len=args.length;i<len;i++ ){
        result.bitField.set( args[i], true );
    }

    // a trick to save some time later
    result._values = result.bitField.toValues();

    return result;
}

module.exports = EntityFilter;