
Entities that share relations with other entities.

https://en.wikipedia.org/wiki/Junction_table

A Link table is used to link one entity to another.

By defining this relationship in the schema, we can avoid having to manually define a link component.


one to many:
add a component which references the many back to the one

each channel contains many entities. the channel component has members, but the members don't neccesarily belong to channels.

select channels which entity 'a' belongs to

Query.selectLink('/component/channel')

// select the channels that the clientId belongs to
Query.all('/component/channel_member').where(Query.attr('client').equals(clientId));
Query.pluck('/component/channel_member', 'channel')
Query.selectById();
