import _ from 'underscore';

// import Entity from '../entity';
import EntitySet from './index';
import EntitySetListener from './listener';

import {
    // clearMap,
    // hash,
    // stringify
} from '../util';



/**
 * 
 */
class EntitySetView extends EntitySet {
    addEntity(entity, options){
        return this._parent.addEntity(entity,options);
    }
    removeEntity(entity, options){
        return this._parent.removeEntity(entity,options);
    }
    addComponent(component, options ){
        return this._parent.addComponent(component,options);
    }
    removeComponent( component, options ){
        return this._parent.removeComponent(component,options);
    }

    /**
     * 
     */
    applyEvents(){
        if( this.listener ){
            this.listener.applyEvents();
        }
        _.each( this.listeners, listener => listener.applyEvents() );
    }
}

EntitySetView.prototype.type = 'EntitySetView';
EntitySetView.prototype.isMemoryEntitySet = true;
EntitySetView.prototype.isEntitySetView = true;

EntitySet.prototype.view = function( query, options={} ){
    let result;
    let registry = this.getRegistry();

    result = registry.createEntitySet( {type:EntitySetView,register:false} );
    result._parent = this;
    // console.log('EntitySetView created view', result.id, result.cid, result.getUUID(), 'from', this.cid );

    // make <result> listenTo <entitySet> using <entityFilter>
    result.listener = EntitySetListener.create(result, this, query, options);
    // EntitySet.listenToEntitySet( result, this, query, options );

    // if a valid query was supplied, it will have been resolved
    // into a query object by now
    query = result.getQuery();

    // console.log('using view query', query);
    // store the view
    this.views || (this.views={});
    this.views[ query ? query.hash() : 'all' ] = result;
    this.trigger('view:create', result);

    return result;
};

EntitySet.prototype.applyEvents = function(){}



export default EntitySet;