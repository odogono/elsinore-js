import { createLog } from "../../util/log";
import { findWithIndex, QueryStack, 
    replace as replaceQueryStack, 
    InstDefMeta,
    pop,
    StackValue,
    InstResult} from "../stack";
import { ComponentRegistry, register, Type as ComponentRegistryT } from "../../component_registry";
import { Type as ComponentDefT, create as createComponentDef, isComponentDef, ComponentDef } from '../../component_def';
import { isObject, isString } from "../../util/is";
import { stringify } from "../../util/json";

const Log = createLog('Inst][ComponentDef');

export const DEF = '@d';
export const DEFs = '!d';

export const meta:InstDefMeta = {
    op: [DEF,DEFs]
};

// export function execute( stack:QueryStack, [op,arg]:StackValue ):InstResult {
//     let def:ComponentDef = parseArg(stack,arg);

//     // if( op === DEF){
//     //     return [stack, [op,arg]];
//     // }

//     // // let properties;
//     // let value:StackValue;
//     // let index:number;
//     // let registry:ComponentRegistry;
//     // let type:string;
//     // // let def:ComponentDef;


//     // // if( isComponentDef(arg) ){
//     // //     def = arg;
//     // // } else if( isObject(arg) ){
//     //     //     def = createComponentDef(arg);
//     // if( arg === undefined ){
//     //         // pop def
//     //     [stack, [, def]] = pop(stack);
//     //     // Log.debug('create', def);
//     //     def = createComponentDef( def );
//     // }

//     // // find the ComponentRegistry in the stack
//     // [index, value] = findWithIndex( stack, ComponentRegistryT );

//     // if( index === -1 ){
//     //     // no registry, so just return value
//     //     return [stack, [ComponentDefT, def]];
//     // }

//     // // Log.debug('create', def);

//     // [type,registry] = value;

//     // let [uregistry] = register( registry, def );
    
//     // stack = replaceQueryStack( stack, index, [type,uregistry] );
    
//     // // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
//     // // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

//     return [stack];
// }

function parseArg(stack:QueryStack, arg:any):ComponentDef {
    if( isComponentDef(arg) ){
        return arg;
    } else if( isObject(arg) ){
        // Log.debug('create', arg);
        return createComponentDef(arg);
    } else {
        return undefined; //createComponentDef();
        // pop def
        // [stack, [, def]] = pop(stack);
        // return createComponentDef( def );
    }
}