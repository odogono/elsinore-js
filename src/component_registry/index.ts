import { ComponentDef } from "../component_def";
import { createUUID } from "../util/uuid";
export type ComponentDefs = Array<ComponentDef>;


export class ComponentRegistry {
    readonly uuid: string;

    readonly componentDefs: ComponentDefs;

    readonly byUri: Map<string, ComponentDef>;

    readonly byHash: Map<number, ComponentDef>;

    constructor(){
        this.uuid = createUUID();
        this.componentDefs = [];
        this.byUri = new Map<string, ComponentDef>();
        this.byHash = new Map<number, ComponentDef>();
    }
}