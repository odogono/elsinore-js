import { BitField, get as bfGet } from "@odgn/utils/bitfield";
import { Component, getComponentDefId, toObject as comToObject } from "../../component";
import { toObject as defToObject } from "../../component_def";
import { Entity } from "../../entity";
import { EntitySet } from "../../entity_set";


export interface ExportOptions {
    retainEid?: boolean;
    defs?: boolean;
    ents?: boolean;
    coms?: boolean;

    // exclude certain components
    exclude?: BitField;
    

    eid?: boolean;

    // write out the component name
    comName?: boolean;
    comDid?: boolean;
    comUrl?: boolean;
}


/**
 * Produces a JSON representation of an EntitySet
 * 
 * @param es 
 * @param options 
 * @returns 
 */
export async function exportEntitySet(es: EntitySet, options: ExportOptions = {}) {
    const exportEnts = options.ents ?? true;
    const exportDefs = options.defs ?? false;
    const exportComs = options.coms ?? false;

    let result: any = {
        url: es.getUrl()
    }

    if( exportDefs ){
        const defs = await es.getComponentDefs();
        let out = [];

        for (const def of defs) {
            out.push( defToObject(def) );
            // buffer.push(`${defToString(def)} !d`);
        }
        result.defs = out;
    }

    if (exportEnts) {
        let ents = [];

        for await (const e of es.getEntities()) {
            ents.push(exportEntity(es, e, {eid:false, ...options} ));
        }

        result.ents = ents;
    }

    if( exportComs ){
        let out = [];
        for await ( const com of es.getComponents() ){
            out.push( exportComponent(es, com, options) );
        }
        result.coms = out;
    }

    return result;
}




/**
 * Produces a JSON representation of an Entity
 * 
 * @param es 
 * @param e 
 * @param options 
 * @returns 
 */
export function exportEntity(es: EntitySet, e: Entity, options: ExportOptions = {}) {
    const { exclude } = options;
    if( e === undefined ){
        return {};
    }
    let result: any = { id: e.id };

    const coms = e.components.values();
    let components: any = [];

    for (const com of coms) {
        if (exclude && bfGet(exclude, getComponentDefId(com)) === true) {
            continue;
        }
        components.push( exportComponent(es, com, {eid:false, ...options} ) );
    }

    if (components.length > 0) {
        result.components = components;
    }

    return result;
}

/**
 * Produces a JSON representation of an Component
 * 
 * @param es 
 * @param com 
 * @param options 
 * @returns 
 */
export function exportComponent( es:EntitySet, com:Component, options: ExportOptions = {} ){
    const exportUrl = options.comUrl ?? false;
    const comName = options.comName ?? false;
    const comDid = options.comDid ?? true;
    const exportEid = options.eid ?? true;

    let { '@e': eid, '@d': did, ...obj } = comToObject(com);
    const def = es.getByDefId(did);

    if( exportEid ){
        obj = { '@e': eid, ...obj };
    }

    if (comName) {
        obj = { '@dn': def.name, ...obj };
    }

    if (exportUrl) {
        obj = { '@du': def.uri, ...obj };
    }

    if (comDid) {
        obj = { '@d': did, ...obj };
    }

    return obj;
}