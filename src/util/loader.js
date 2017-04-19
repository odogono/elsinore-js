
import {createLog} from './log';
import {omit,readProperty,stringify} from './index';
import {toString as entityToString} from './to_string';

export const CMD_UNKNOWN = "@unk";
export const CMD_COMMAND = "@cmd";
export const CMD_ADD_ENTITY = 'entity';
export const CMD_REGISTER_COMPONENT = 'register';
export const CMD_DELETE_ENTITY = 'rme';
export const CMD_DELETE_COMPONENT = 'rmc';

const Log = createLog('JSONLoader');



export class JSONLoader {

    /**
     * 
     */
    load( commands, entitySet, options={} ){
        const registry = this.registry = entitySet.getRegistry();
        let context = { entitySet, registry };
        
        // execute each command in turn
        return commands.reduce(
            (current,cmd) => current.then( () => this._processCommand(context,cmd) ), 
            Promise.resolve() );
    }


    /**
     * 
     */
    _processCommand( context, command, options={} ){
        const [type,cmd,arg] = findCommand( command );

        switch(cmd){
            case CMD_ADD_ENTITY:
                return this._addEntityToEntitySet(context,options);
                // return addEntity(registry, entitySet, loader.entity)
            case CMD_REGISTER_COMPONENT:
                return this._registerComponent(context,arg);
            case CMD_DELETE_ENTITY:
                return this._deleteEntity(context,arg,options);
            case CMD_DELETE_COMPONENT:
                return this._deleteComponent(context,arg,options);
            default:
                return this._createComponent(context,command,options);
        }
        
    }


    _createEntity(context){
        if( context.entity ){
            // already have an entity, so add it to the load cache
            return _processCommand( context, {'@cmd': CMD_ADD_ENTITY} )
                .then( (context) => this._createEntity(context) );
        }

        context.entity = context.registry.createEntity();

        return Promise.resolve(context);
    }

    _deleteEntity(context, args, options={}){
        const entityId = args ? args.eid : undefined;
        if( entityId === undefined ){
            return Promise.resolve(context);
        }

        return Promise.resolve(context.entitySet.removeEntity(entityId))
            .then( () => context );
    }

    _deleteComponent(context, args, options={}){
        const componentId = args ? args.cid : undefined;
        if( componentId === undefined ){
            return Promise.resolve(context);
        }

        return Promise.resolve(context);

        // return Promise.resolve(context.entitySet.removeComponent(componentId))
            // .then( () => context );
    }

    /**
     * 
     */
    _addEntityToEntitySet( context, options={} ){
        const {entity,entitySet} = context;
        return Promise.resolve(entitySet.addEntity(entity))
            .then( () => {
                context.entity = null;
                return context;
            })
    }

    /**
     * 
     */
    _createComponent( context, obj, options ){
        const debug = readProperty(options,'debug',false);
        if( debug ){ Log.debug(`[createComponent] from`, (obj) ); }
        const component = context.registry.createComponent( obj );

        // if( debug ){ Log.debug(`[createComponent]`, stringify(component) ); }

        // if an explicit entityid is set, then add directly to the entityset
        if( obj['@e'] ){
            return context.entitySet.addComponent( component );
        }

        if( !context.entity ){
            return this._createEntity(context)
                .then( () => context.entity.addComponent(component) );
        }

        
        context.entity.addComponent(component);

        if( debug ) Log.debug('[createComponent] add to entity', context.entitySet.cid, entityToString(context.entity));

        return component;
    }


    _registerComponent( context, args ){
        // Log.debug(`[registerComponent]`, stringify(args) );

        return context.registry.registerComponent(args);
    }
}


function findCommand( obj ){
    if( obj[CMD_COMMAND] ){
        return [CMD_COMMAND, obj[CMD_COMMAND], omit(obj,CMD_COMMAND)];
    }
    return [CMD_UNKNOWN,null];
}



JSONLoader.create = function(){
    let result = new JSONLoader();
    return result;
}