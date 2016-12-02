import _ from 'underscore';
import {Model as BackboneModel} from 'odgn-backbone-model';
import Registry from './index';
import Query from '../query';
import EntitySet from '../entity_set/view';
import {createLog} from '../util/log';

const Log = createLog('Registry.Processor');

/**
*   A registry which is capable of dealing with processors
*/
_.extend( Registry.prototype, {
    /**
    *   Adds a new processor instance
    */
    addProcessor: function( processorModel, entitySet, options={} ){
        
        let processor;
        let processorId;
        let processorAttrs;
        let processorOptions;
        
        let priority;
        let updateable;

        processorId = this.createId(); //processorModel.id || options.id;
        priority = _.isUndefined(options.priority) ? 0 : options.priority;
        updateable = _.isUndefined(options.update) ? true : options.update;

        processorAttrs = {id:processorId, priority, updateable};
        processorOptions = {Model:processorModel,registry:this};

        if( entitySet ){
            processorAttrs.entitySet = entitySet;
        }

        

        // create the processor instance using either the passed processor, or the base
        // processor create function
        processor = (processorModel.create || EntityProcessor.create)(
            processorAttrs, processorOptions);

        processor.registry = this;

        if( processorModel && processorModel.onLoad ){
            processorModel.onLoad( this );
        }

        // create the entity filter(s) specified by the processor
        this._mapEntitySetToProcessor( entitySet, processor, options );
        
        // if the processor has event listeners defined, connect those to the entityset
        this._attachEntitySetEventsToProcessor( entitySet, processor );

        // this.processors.add( processor );

        // console.log('added processor', processor.type );
        this.trigger('processor:add', processor );
        
        return processor;
    },

    /**
        creates a mapping between the entityset and the processor.
        the processor may specify a filter for the given entityset, so
        a view can be generated in that case.
        The given entitySet may also specify that it is not optimal for
        an update, so in that case a view will also be generated.

        Entity views are stored according to their hash, so that
        multiple processors may operate on the same set.

        - generate a hash for the required entitySet/entityFilter combination
        - if the hash already exists, then retrieve the mapping and add the
            processor to the list
        - if the hash doesn't exist, create the view from the src entityset
    */
    _mapEntitySetToProcessor: function( entitySet, processor, options ){
        let filter, hash, view, entitySetProcessors, debug;

        let record = new BackboneModel({
            id: processor.id,
            entitySet,
            processor
        });

        debug = options.debug;

        // log.debug('adding processor ' + processor.type );
        // decide on which view (if any) to use with the processor
        if( processor.entityFilter ){

            // convert the supplied directives into entityFilter instances
            // if( debug ){ log.debug('creating filter ' + processor.entityFilter ); }
            filter = new Query(processor.entityFilter);

            // do we already have a view for this filter?
            hash = EntitySet.hash( entitySet, filter );
            // if( debug ){ log.debug('hashed es query ' + hash + ' ' + filter.hash() + ' ' + JSON.stringify(filter) ); }

            if( this._entityViews[ hash ] ){
                view = this._entityViews[ hash ];
            } else {
                // query a view using the filter from the source entitySet
                view = entitySet.view( filter );

                this._entityViews[ hash ] = view;
                
                this.trigger('view:create', view);
                
                // if( debug ) {log.debug('new view ' + view.cid + '/' + view.hash() 
                //     + ' with filter ' + filter.hash() 
                //     + ' has ' + entitySet.models.length 
                //     + ' entities for ' + processor.type );}
            }

            // log.debug('setting view ' + view.cid + ' onto ' + processor.type );
            record.set('view', view);
        } else {
            record.set('view', entitySet);
        }

        processor.entitySet = entitySet;
        processor.view = view || entitySet;
        processor.entityFilter = filter;

        if( !record.get('processor') ){
            throw new Error('no processor added!', record);
        }
        // Log.debug('adding record', _.keys(record.attributes) );
        this.entitySetProcessors.add( record );

        // store the mapping between the entityset and the processor
        // an entityset can have multiple processors
        // entitySetProcessors = this.entitySetProcessors[ entitySet.id ] || createProcessorCollection();
        // entitySetProcessors.add( processor );
        // this.entitySetProcessors[ entitySet.id ] = entitySetProcessors;
    },

    _attachEntitySetEventsToProcessor: function( entitySet, processor ){
        let name;
        if( !processor.events ){ return; }
        
        for( name in processor.events ){
            this._createProcessorEvent( entitySet, processor, name, processor.events[name] );
        }
    },

    _createProcessorEvent: function( entitySet, processor, name, event ){
        // // curry the event function so that it receives the entity and the entityset as arguments
        // // NOTE: because we use the arguments object, we can't use es6 fat arrows here
        return processor.listenToAsync( entitySet, name, function( pName, pEntity, pEntitySet ){
            let args = Array.prototype.slice.call( arguments, 2 );
            args = [pEntity, entitySet].concat(args);
            // log.debug('apply evt ' + pName + ' ' + JSON.stringify(args) );
            return event.apply( processor, args);
        });
    },
    

    // update: function( callback ){
    //     let self = this;
    //     let now = Date.now();
    //     let dt = now - this.updateLastTime;
    //     this.updateLastTime = now;
    //     this.updateStartTime += dt;
    //     let updateOptions = {};

    //     this.trigger('processor:update:start', this);

    //     let current = Promise.fulfilled();

    //     return Promise.all( 
    //         this.processors.models.map( function(processor){
    //             return current = current.then(function() {
    //                 // log.debug('calling update ' + dt );
    //                 return processor.update( dt, self.updateStartTime, now, updateOptions );
    //             });
    //         })).then( function( results ){
    //             self.trigger('processor:update:finish', self );
    //         });
    // },

    update: function( timeMs, options={} ){
        let debug;
        debug = options.debug;

        return _.reduce( this.entitySetProcessors, (current, record) => {
            return current.then(() => {
                let processor = record.get('processor');
                let view = processorRecord.get('view');
                let entityArray = view.models;

                if( !entityArray || entityArray.length === 0 ){ return processor; }

                return processor.onUpdate( entityArray, timeMs )
                    .then(() => processor.applyChanges())
                    .then(() => {
                        if( view.isModified ){
                            return view.applyEvents();
                        }
                        return processor;
                    });
            });
        }, Promise.resolve() );
    },

    /**
    *   Updates the processors attached to each entityset
    */
    updateSync: function( timeMs, options={} ){
        let entitySet;
        let entitySetId;
        let entitySetProcessors;
        let debug;
        let ii,len;

        debug = options.debug;
        
        if(debug){ log.debug('> registry.updateSync'); }

        // iterate through each of the entitysets which have processors
        this.entitySetProcessors.each( (processorRecord) => {
            let processor = processorRecord.get('processor');
            let view = processorRecord.get('view');
            let entityArray = view.models;

            // dispatch any events that the processor has collected
            // from the last update loop
            if( processor.isListeningAsync ){
                processor.isReleasingEvents = true;
                processor.releaseAsync();
                processor.isReleasingEvents = false;
            }

            // execute any queued events that the processor has received
            if( debug ){ 
                log.debug('executing processor ' + processor.type + ' ' + 
                    processor.get('priority') + 
                    ' with ' + view.cid +'/'+ view.hash() + ' ' + 
                    entityArray.length + ' entities'); 
            }
            

            // if the view needs updating due to entities or components being 
            // added/updated/removed, then do so now
            // the view is updated /before/ it is updated - previously it was
            // after, but this might lead to dependent views/sets getting out of
            // sync
            view.applyEvents();
            
            // allow the processor to process the entities
            if( entityArray.length > 0 ){
                processor.onUpdate( entityArray, timeMs, options );
            }

            // apply any changes to the entitySet that the processor may have queued
            // changes involve adding/removing entities and components
            // NOTE: this includes creating and destroying entities - do we want to leave these ops till after all processors have run?
            processor.applyChanges();
        });
    },
});

// module.exports = Registry;
export default Registry;