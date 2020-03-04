# ElsinoreJS

## Getting Started

```javascript
var registry = new Registry();
```

Create an EntitySet:

```javascript
var entitySet = registry.createEntitySet();
```

Register component types:

```javascript
registry.registerComponent( [
    {uri:'/position', properties:{ file:{type:'string'}, rank:{type:'integer'}} },
    {uri:'/piece/king'},
    {uri:'/piece/pawn'},
    {uri:'/piece/queen'},
    {uri:'/colour', properties:{ colour:{type:'string'}}} 
]);
```


add some entities:

```javascript
entitySet.addEntity([{'@c':'/piece/king'}, {'@c':'/colour', colour:'white'}, {'@c':'/position', file:'e', rank:1}]);
entitySet.addEntity([{'@c':'/piece/pawn'}, {'@c':'/colour', colour:'white'}, {'@c':'/position', file:'a', rank:2}]);

entitySet.addEntity([{'@c':'/piece/queen'}, {'@c':'/colour', colour:'black'}, {'@c':'/position', file:'d', rank:8}]);
entitySet.addEntity([{'@c':'/piece/pawn'}, {'@c':'/colour', colour:'black'}, {'@c':'/position', file:'a', rank:7}]);
```


simple query:

```javascript
entitySet.query( Q => Q.all('/piece/pawn') )
```

```javascript
entitySet.query( Q => Q.all().where( Q.attr('file').equals('a') );
```

