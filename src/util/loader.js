
import {createLog} from './log';
import {omit,stringify} from './index';
import {toString as entityToString} from './to_string';

export const CMD_UNKNOWN = "@unk";
export const CMD_COMMAND = "@cmd";
export const CMD_ADD_ENTITY = 'entity';
export const CMD_REGISTER_COMPONENT = 'register';

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
                return this._addEntityToEntitySet(context);
                // return addEntity(registry, entitySet, loader.entity)
            case CMD_REGISTER_COMPONENT:
                return this._registerComponent(context,arg);
            default:
                return this._createComponent(context,command);
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
    _createComponent( context, obj ){
        const component = context.registry.createComponent( obj );

        // Log.debug(`[createComponent]`, stringify(component) );

        if( !context.entity ){
            return this._createEntity(context)
                .then( () => context.entity.addComponent(component) );
        }

        context.entity.addComponent(component);
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