var _ = require('underscore');
var Backbone = require('backbone');
var BitField = require('./bit_field');
var Utils = require('./utils');

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

_.extend( EntityFilter.prototype, {

    add: function( filter, options ){
        this.filters || (this.filters=[]);
        this.filters.push( filter );
        return this;
    },

    /**
    * Returns true if the passed entity is accepted
    */
    accept: function(entity, options){
        var i,len,result;
        var bf = this.bitField;
        var ebf = entity.getComponentBitfield();
        var bfCount = bf.count();
        var ebfCount = ebf.count();
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
                if( !BitField.aand( bf, ebf, options ) ){
                    return false;
                }
                break;
            case EntityFilter.ALL:
                if( bfCount == 0 )
                    return true;
                if( !BitField.and( bf, ebf, options ) ){
                    return false;
                }
                break;
        }
        if( this.filters ){
            for( i=0,len=this.filters.length;i<len;i++ ){
                if( !this.filters[i].accept(entity,options) )
                    return false;
            }
        }
        return true;
    }
});

EntityFilter.ALL = 0;
EntityFilter.ANY = 1;
EntityFilter.SOME = 2;
EntityFilter.NONE = 3;

EntityFilter.extend = Backbone.Model.extend;

EntityFilter.create = function( type, componentDefs ){
    var i,len,cDefId;
    // console.log('create ' + JSON.stringify(_.toArray(arguments)));
    var result = new EntityFilter( type );

    if( componentDefs ){
        for( i=0,len=componentDefs.length;i<len;i++){
            cDefId = Utils.isInteger( componentDefs[i] ) ? componentDefs[i] : componentDefs[i].id;
            result.bitField.set( cDefId, true );
        }
    }

    return result;
}

module.exports = EntityFilter;