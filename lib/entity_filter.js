var Backbone = require('backbone');
var BitField = require('./bit_field');
var Utils = require('./utils');


function EntityFilter( bf ){
    this.bitField = BitField.create();
    this.type = EntitFilter.AND;
}

_.extend( EntityFilter.prototype, {
    filter: function( entity ){
        var result = false;
        // all everything through
        if( this.bitField.count() == 0 )
            return entity;
        var bf = entity.getComponentBitfield();

        switch( this.type ){
            case EntityFilter.AND:
                result = this.bitField.and( null, bf, this.bitField );
                break;
            case EntityFilter.OR:
                result = this.bitField.and( null, bf );
                break;
            case EntityFilter.NOR:
                result = this.bitField.and( null, bf );
                break;
        }

        return result ? this : null;
    },
},{
    AND: 0, // 
    OR: 1,
    NOR: 2
});

EntityFilter.extend = Backbone.Model.extend;

module.exports = EntityFilter;