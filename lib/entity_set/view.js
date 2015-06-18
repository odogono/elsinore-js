'use strict';

var _ = require('underscore');

var EntitySet = require('../entity_set');
var Query = require('../query');
var Utils = require('../utils');

_.extend( EntitySet.prototype, {

    view: function( query, options ){
        var result;
        var registry = this.getRegistry();
        
        options = options || {};

        result = registry.createEntitySet( null, {register:false} );
        result.type = 'EntitySetView';
        result.isEntitySetView = true;

        // make <result> listenTo <entitySet> using <entityFilter>
        EntitySet.listenToEntitySet( result, this, query, options );

        // store the view
        this.views || (this.views={});
        this.views[ query ? query.hash() : 'all' ] = result;
        this.trigger('view:create', result);

        return result;
    }

});