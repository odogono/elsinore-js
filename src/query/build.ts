import { 
    Type as ComponentRegistryT, 
    ComponentRegistry } from "../component_registry";
import { QueryStack, pushValues } from "./stack";


export type buildDefFn = (uri: string, ...args: any[]) => void;
export type buildComponentFn = (uri: string, props:object) => void;
export type buildInstFn = (...args: any[]) => void;
export type buildEntityFn = () => void;
export type buildValueFn = (registry: ComponentRegistry) => void;
export interface BuildQueryParams {
    def:buildDefFn, 
    component: buildComponentFn,
    entity:buildEntityFn,
    inst:buildInstFn,
    value:buildValueFn
}
export type BuildQueryFn = (BuildQueryParams) => void;

export function build( stack:QueryStack, buildFn:BuildQueryFn ):any[] {

    let stmts = [];

    const def = (uri:string, args) => 
        stmts = [...stmts, {uri, properties:args }, '!d' ];
    const component = (uri:string, props:object) => 
        stmts = [...stmts, {'@c':uri, ...props}, '!c' ] ;
    const entity = () => stmts.push( [ '!e'] );
    const value = (registry:ComponentRegistry) => stmts.push( [ ComponentRegistryT, registry ] );
    const inst = (...args) => stmts.push(args);

    buildFn( {inst, component, def, entity, value} );

    return stmts;
}


export async function buildAndExecute( stack:QueryStack, buildFn:BuildQueryFn ): Promise<QueryStack> {
    const stmts = build( stack, buildFn );

    // console.log('[buildAndExecute]', stack.items );
    // console.log('[buildAndExecute]', stmts );

    [stack] = await pushValues( stack, stmts );


    return stack;
}