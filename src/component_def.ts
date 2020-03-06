

export class ComponentDef {
    id: number;
    uri: string;
    name: string;
    properties: Map<string, any>;
    additional: Map<string, any>;

    constructor(){
        this.id = 0;
        this.uri = '';
        this.name = '';
        this.properties = new Map<string, any>();
        this.additional = new Map<string, any>();
    }
}
