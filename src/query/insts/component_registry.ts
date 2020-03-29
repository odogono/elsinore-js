import { createLog } from "../../util/log";
import {
    findWithIndex, QueryStack,
    peek as peekQueryStack,
    push as pushQueryStack,
    replace as replaceQueryStack,
    InstDefMeta,
    StackValue,
    pop,
    InstResult
} from "../stack";
import { 
    createComponent, 
    Type as ComponentRegistryT, 
    resolveComponentDefIds
} from "../../component_registry";
import { Type as ComponentT } from '../../component';
import { isObject } from "../../util/is";
import { stringify } from "../../util/json";
import { StackList } from "./stack";
import { getDefId, toObject as defToObject, ComponentDef } from '../../../src/component_def';

const Log = createLog('Inst][ComponentRegistry');

export const ComponentRegistry = '@cr';

export const meta:InstDefMeta = {
    op: '@cr'
};


export function executeFetch( stack:QueryStack, [,registry]:StackValue, [op,arg]:StackValue ): InstResult {
    // Log.debug('[executeFetch]', [op,arg] );
    let defs = resolveComponentDefIds( registry, [arg], {asDef:true} ) as ComponentDef[];

    if( defs.length === 1 ){
        return [ stack, ['@d', defs[0]] ];
    } else {
        return [ stack, [StackList, defs]];
    }
}

export function toListValue( stack:QueryStack, [op,registry]:StackValue ): InstResult {

    let insts = registry.componentDefs.map( def => {
        const obj = defToObject(def);

        // if( obj.properties.length > 0 ){
        //     return [ obj.properties, obj.uri, '@d' ];
        // }
        return [ obj, '@d' ];
    });


    return [stack, [StackList, insts ]];
}


// export function execute(stack: QueryStack, [op,arg]:StackValue ):InstResult {
//     let value:StackValue;

//     let uri:string;
//     let attributes:object;

//     // pop uri
//     [stack, value] = pop(stack);
//     uri = value[1];

//     // pop properties
//     [stack, value] = pop(stack);
//     attributes = value[1];

//     // find the ComponentRegistry in the stack
//     let [index, [type, registry]] = findWithIndex(stack, ComponentRegistryT);

//     if (index === -1) {
//         throw new Error('ComponentRegistry missing on stack');
//     }
    
//     const component = createComponent(registry, uri, attributes );
    
//     // Log.debug('[execute]', 'created', attributes, component );

//     value = [ ComponentT, component];
//     // stack = pushQueryStack( stack, [ ComponentT, component] );
//     // stack = replaceQueryStack(stack, index, [type, registry]);

//     // Log.debug('[execute]', JSON.stringify( stack, null, '\t' ) );
//     // Log.debug('[execute]', uri, properties, peekQueryStack(stack) );

//     return [stack, value];
// }