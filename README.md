
A node.js Entity Component system.

Nothing worth seeing yet - move along.


A Registry instance is required to manage entities and components:

    Registry.create().done( function(newRegistry){ });

returns a promise for a new entity instance:

    registry.createEntity().done( function(newEntity){ });

to assign data to an entity, a component should be created by first registering it:

    var componentSchema = {
        "id": '/component/position'
        "properties":{
            "x":{ "type":"number",  },
            "y":{ "type":"number" }
        }
    };

    registry.registerComponent(componentSchema).done( function(componentDef){ });

the component can then be added to the entity using its id:

    registry.addComponent( '/component/position', entity ).done( function(componentInstance){ });
    or
    entity.addComponent( '/component/position' ).done( function(componentInstance){ });

and retrieved:

    registry.getComponent( '/component/position', entity ).done( function(componentInstance){ });
    or
    entity.getComponent( '/component/position' ).done( function(componentInstance){ });

or removed:

    registry.removeComponent( '/component/position', entity ).done( function(entity){ });


Entities can also be created with components already attached:

    registry.createEntity( ['position','velocity'] ).done( function(entity){ });

Which is the same as:

    registry.createEntity()
    registry.addComponent('position', entity)
    registry.addComponent('velocity', entity)

and then referenced:

    entity.Position.get('x');
    entity.Velocity.get('y');


EntitySets are collections of entities.

    registry.createEntitySet().done( function(entitySet){ });


which can be iterated through

    entitySet.forEach( function(entity){ });






{
    "id":"/component/child/example",
    "properties":{
        "entity_id":{ "type":"integer", "format":"entity_id" }
    }
}

    parent = registry.createEntity({id:254}).done();

add component to child:

    child = registry.createEntity().done();
    child.addComponent( '/component/child/example', {entity_id:254} ).done();

parent retrieves children:

    entity.getEntities( '/component/child/example' ).done( function(entities){} );
    registry.getEntities( {schemaId:'/component/child/example',entity_id:254} ).done( function(entities){} );

the argument to getChildEntities is a component matcher. The parents id is added to the matcher
