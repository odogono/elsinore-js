var entity = require('./entity');
var EntityCollection = require('./entity_collection');
// module.exports.createEntityCollection = require('./entity_collection').create;


var oldRegisterEntity = entity.registerEntity;
entity.registerEntity = function( entityDef, entity, options ){
    entityDef = oldRegisterEntity.apply(this,arguments);
    initEntityER( entityDef, options );
    return entityDef;
};


// add some more functions to the Entity type
_.extend( entity.Entity.prototype, {

    // Returns the details of a o2o relation if an erName is specified
    //    otherwise returns a map of all o2o relations 
    getOneToOne: function( erName ){
        var def, result = {};
        var entityDef = entity.ids[this.entityType];
        if( !entityDef )
            return null;
        for( var i in entityDef.ER ){
            def = entityDef.ER[i];
            if( def.oneToOne ){
                if( erName && (erName === def.name || erName === def.entityType) )
                    return def;
                result[ def.name || def.entityType ] = def;
            }
        }
        return result;
    },

    // Returns the details of a o2m relation if an erName is specified
    //    otherwise returns a map of all o2m relations
    getOneToMany: function( erName ){
        var def, result = {};
        var entityDef = entity.ids[this.entityType];
        if( !entityDef )
            return null;
        for( var i in entityDef.ER ){
            def = entityDef.ER[i];
            if( def.oneToMany ){
                if( erName && (erName === def.name || erName === def.entityType) )
                    return def;
                result[ def.name || def.entityType ] = def;
            }
        }
        return result;
    }
});




var initEntityER = function( entityDef, options ){
    options = (options || {});
    // the ER spec matches the key to a TYPE string - string because the types usually
    // aren't set up at the time of creation

    function resolveEntity( entityId ){
        var result = {};
        
        // resort to looking up entity from entity registry
        result = entity.getEntityFromType(entityId);

        if( result ){
            result = _.clone( result );
            result.name = result.name || result.entityType;
        }
        
        return result;    
    }

    _.each( entityDef.ER, function(spec){
        var refEntity,details;
        
        if( spec.oneToMany ){
            refEntity = resolveEntity( spec.oneToMany );
            if( refEntity ){
                spec.entityType = refEntity.entityType;
                spec.name = spec.name || refEntity.entityType;
            }

            module.exports.oneToMany( entityDef, spec, options );
        }
        if( spec.oneToOne ){
            refEntity = resolveEntity( spec.oneToOne );
            if( refEntity ){
                spec.entityType = refEntity.entityType;
                spec.name = spec.name || refEntity.entityType;
            }
            // spec = _.extend( spec, resolveEntity( spec.oneToOne ) );
            module.exports.oneToOne( entityDef, spec.entityType );
        }

        if( spec.entityType ){
            refEntity = resolveEntity( spec.entityType );
            if( !refEntity )
                throw new Error('entity ' + spec.entityType + ' not defined');
            if( refEntity ){
                spec.name = refEntity.name = spec.name || refEntity.entityType;
            } 
            if( refEntity.oneToMany ){
                spec.oneToMany = true;
                module.exports.oneToMany( entityDef, refEntity, options );
            }
            // log( 'using ');
            // print_ins( refEntity );
        }
    });

    // if( options.oneToMany ){
    //     log('requested as o2m');
    // }
};

exports.oneToOne = function( entityDef, codomainType, options ){
    if( codomainType === undefined || entityDef === undefined )
        return;
    var debug = options && options.debug,
        codomainName = _.capitalize(entity.names[codomainType]);

    // entityDef.entity.prototype[ 'set' + codomainName ] = function( otherEntity, options ){
    //     this.set( '_'+codomainType, otherEntity, options );
    // };

    // entityDef.entity.prototype[ 'get' + codomainName ] = function(){
    //     return this.get('_'+codomainType);
    // };
};


exports.oneToMany = function( entityDef, spec, options ){
    if( !spec  || !spec.entityType || entityDef === undefined ){
        log.debug('could not find spec ' + JSON.stringify(spec) );
        return;
    }
    var debug = options && options.debug,
        codomainType = spec.entityType,
        domain = entityDef._entityClass,
        codomainName = _.capitalize( spec.name || entity.names[spec.entityType]),
        codomainNameLower = codomainName.toLowerCase();

    debug = entityDef.entityType === 'o2m';

    // create the oneToOne on the codomain - this means it now has set and get methods
    exports.oneToOne( entity.ids[ spec.entityType ], entityDef.entityType, options );
    
    // override existing initialize to create a collection
    var existingInitialize = entityDef._entityClass.prototype.initialize;

    // provide a new initialisation function which allows the collection to 
    // be instantiated
    entityDef._entityClass.prototype.initialize = function(){
        var self = this,
            entityName = codomainName.toLowerCase();

        var collection = spec.create ? spec.create({entity:codomainType}) : EntityCollection.create({entity:codomainType});
        var collectionName = entityName != codomainType ? entityName : codomainType;
        var childRelationKey = '_'+ entityDef.entityType+':'+collectionName;
        
        // a reference from the collection to its owning entity
        collection.owner = this;
        collection.name = collectionName;
        collection.inverseKey = spec.inverse;
        
        this[ codomainNameLower ] = collection;
        
        existingInitialize.apply(this, arguments);
    };
};

exports.addEntityToEntity = function( childEntity, parentEntity, specifier ){
    var entity = module.parent.exports,
        ers = entity.ids[parentEntity.entityType].ER;
    // log('adding ' + childEntity.id + ' to ' + parentEntity.id + ' using ' + specifier);

    // look for the first relationship in the parent that we can add the child to
    _.each( ers, function(er){
        if( er.entityType == childEntity.entityType ){
            if( er.oneToOne )
                parentEntity[ '_' + er.name ] = childEntity;
            else if( er.oneToMany ){
                // log( parentEntity.id + ' adding to collection ' + inspect(er) );
                parentEntity[ er.name ].add( childEntity, {silent:true} );
            }
        }
    });
};