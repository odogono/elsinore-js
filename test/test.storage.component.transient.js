var Common = require('./common');



describe('Storage', function(){

    describe('Transient Components', function(){
        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ self.storage = storage; });
        });

        afterEach( function(){
        });
    });

});