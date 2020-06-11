import { EntitySet } from "../entity_set";
import { create as createChangeSet, ChangeSet } from "../entity_set/change_set";
import { EntityId } from "../entity";




/**
 * Compares two EntitySets and returns differences
 * 
 * indicate which entities have been added/removed/updated based on EntityId
 * 
 * diff on entities only - add/remove/update based on EntityId and BitField
 * diff on components - add/remove/update based on component properties
 * 
 * provide a query in order to identify entities
 */
export function esDiff(esA:EntitySet, esB:EntitySet):ChangeSet<EntityId>{

    return createChangeSet();
}