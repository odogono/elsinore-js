

export type ComponentProperties = Map<string, any>;

export class Component {
    defId: number;
    entityId: number;
    properties: Map<string, any>;

    constructor(defId: number, entityId: number = 0, properties:ComponentProperties = new Map<string, any>()){
        this.defId = defId;
        this.entityId = entityId;
        this.properties = properties;
    }
}