import { EntitySetMem } from "../entity_set";
import { createLog } from "../util/log";
const Log = createLog('EntitySetIDB');


export class EntitySetFS extends EntitySetMem {
    type: string = 'fs';
    isAsync: boolean = true;

    constructor(data?:EntitySetFS){
        super(data as any);
    }
}