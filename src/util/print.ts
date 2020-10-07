import { Entity } from "../entity";
import { EntitySet, EntitySetMem } from "../entity_set";
import { BitField, get as bfGet } from "./bitfield";






export function printAll(es: EntitySet, ents?: Entity[], dids?:string[]) {
    let result = ents || selectAll(es);
    for (const e of result) {
        printEntity(es, e, dids);
    }
}

export async function printQuery(es: EntitySet, q: string) {
    let result = await es.queryEntities(q);
    for (const e of result) {
        printEntity(es, e);
    }
}

export function printEntity(es: EntitySet, e: Entity, dids?:string[]) {
    let bf:BitField;
    if( es === undefined || e === undefined ){
        console.log('(undefined e)');
        return;
    }
    if( dids !== undefined ){
        bf = es.resolveComponentDefIds(dids);
    }
    console.log(`- e(${e.id})`);
    for (const [did, com] of e.components) {
        if( bf && bfGet(bf,did) === false ){
            continue;
        }
        const { '@e': eid, '@d': _did, ...rest } = com;
        const def = es.getByDefId(did);
        console.log(`   ${def.name}`, JSON.stringify(rest));
    }
}

function selectAll(es: EntitySet): Entity[] {
    if( es instanceof EntitySetMem ){
        return es.getEntitiesByIdMem(true, { populate: true });
    }
    return [];
}