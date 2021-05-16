Elsinore.js
===========

**A Javascript Entity Component System**

[![Build Status](https://secure.travis-ci.org/odogono/elsinore-js.png)](http://travis-ci.org/odogono/elsinore-js)

[![NPM](https://nodei.co/npm/elsinore-js.png?stars&downloads&downloadRank)](https://nodei.co/npm/elsinore-js/) [![NPM](https://nodei.co/npm-dl/elsinore-js.png?months=6&height=3)](https://nodei.co/npm/elsinore-js/)

<a name="intro"></a>
Introduction
------------


<a name="basic"></a>
Basic Usage
-----------


<a name="concepts"></a>
Concepts
-----------


<a name="api"></a>

## API

### Component

A Component is a collection of data, identified by a url. (RE-PHRASE)


### Entity

An Entity in the strictest sense is merely an integer. Elsinore has an Entity class which provides a number of helpful functions for working with it.

An entities id is made up of two parts - the entity id, and an entityset id.


### EntitySet

There are generally two kinds of EntitySet - synchronous and asynchronous. As you might guess, the latter has a promise based API.

EntitySets may be persistent or transient. The default EntitySet is memory based and asynchronous. EntitySets that are persistent (and asynchronous) may use a database, such as redis, indexeddb or sqlite.  

You can add components and entities to an entityset.

An EntitySet will assign an id to an entity or component if it does not already have one.

EntitySets have a UUID.

EntitySets may emit events when entities and components are added, removed, or updated.


### Memory EntitySet

If an entity or component has an id already, the EntitySet will not replace it.

Adding a component to the EntitySet creates a copy of it. 

Retrieving a component from the EntitySet does not copy it, so that you can mutate the component directly. 



### Query

Queries are used to select a subset of entities from an EntitySet. The result is usually another EntitySet or a single Entity.


### Registry

### Schema

