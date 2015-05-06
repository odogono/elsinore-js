export default function run( test, Common, Elsinore, EntitySet ){

    var Component = Elsinore.Component;
    var Entity = Elsinore.Entity;
    var Query = Elsinore.Query;

    test('calling query returns a Query object', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry );

        let query = entitySet.query("/component/status");

        t.ok( Query.isQuery(query), 'the result is an instance of Query' );

        let result = query.execute();

        t.ok( EntitySet.isEntitySet(result) );
        t.equal( result.size(), 3 );

        t.end();
    });

    test('query filtering by component attribute', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry );

        let result = entitySet.query('/component/status')
            .filter( entity => entity.Status.get('status') == 'active' )
            .execute();

        // let result = Query.create(entitySet)
        //     .select('/component/status').attr('status').equals('active')
        //     // .filter( q => q )
        //     .execute();
        
        t.equal( result.size(), 2 );

        t.end();
    });


    test('retrieving referenced entities', t => {
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );

        let result = entitySet
            .query('/component/channel_member')
            .filter( entity => entity.ChannelMember.get('client') === 5 )
            // .filterByAttr( '/component/channel_member', {'client':5} )
            .retrieveEntity( '/component/channel_member', ['channel','client'] )
            .execute();

        // the result should have 3 entities - channel_member, channel and client
        t.equal( result.size(), 3 );

        t.end();
    });
}


// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}