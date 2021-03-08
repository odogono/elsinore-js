import { Component, ComponentId } from "./component";
import { Entity, EntityId } from "./entity";
import { AddOptions, AddType, CloneOptions, EntitySet, EntitySetOptions, RemoveEntityType, RemoveType } from "./entity_set";
import { QueryStack } from "./query";
import { StackValue } from "./query/types";


/**
 * Proxies calls to another EntitySet. Useful for overriding and intercepting certain calls
 */
export class ProxyEntitySet extends EntitySet {
    es: EntitySet;
    type: string = 'proxy';

    constructor(es:EntitySet, options: EntitySetOptions = {}) {
        super( undefined, options );
        this.es = es;
    }
    getUrl(){
        return `es://${this.type}/?uuid=${this.uuid}`;
    }

    async size(): Promise<number> {
        return this.es.size();
    }

    clone(options: CloneOptions = {}) {
        let result = new ProxyEntitySet(this.es.clone());
        return result;
    }

    select(stack: QueryStack, query: StackValue[]): Promise<StackValue[]> {
        return this.es.select(stack, query);
    }

    async getComponent(id: ComponentId | Component): Promise<Component> {
        return this.es.getComponent(id);
    }

    async removeComponent(item: RemoveType, options: AddOptions = {}): Promise<EntitySet> {
        return this.es.removeComponent(item, options);
    }

    async removeComponents(items: RemoveType[], options: AddOptions = {}): Promise<EntitySet> {
        return this.es.removeComponents(items,options);
    }

    async removeEntity(item: RemoveEntityType, options: AddOptions = {}): Promise<EntitySet> {
        return this.es.removeEntity(item, options);
    }

    getComponents(): AsyncGenerator<Component, void, void> {
        return this.es.getComponents();
    }

    getEntities(){
        return this.es.getEntities();
    }
    
    async getEntity(eid: EntityId, populate: boolean = true): Promise<Entity> {
        return this.es.getEntity(eid,populate);
    }
    

    addComponents(components: Component[], options?: AddOptions): Promise<EntitySet> {
        return this.es.addComponents( components, options );
    }

    applyRemoveChanges(): Promise<EntitySet> {
        return this.es.applyRemoveChanges();
    }

    async markEntityComponentsRemove(eids: EntityId[]): Promise<EntitySet> {
        return this.es.markEntityComponentsRemove(eids);
    }
}