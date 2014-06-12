

var BitField = function (){
    this.values = [];
};

BitField.prototype.reset = function(){
    this.values = [];
}

BitField.prototype.size = function(){
    return this.values.length * 32;
}

BitField.prototype.count = function( values ){
    var i,l,count,x;
    values = values || this.values;
    if( values.length == 0 )
        return 0;
    count = 0;
    for (i=0,l=values.length;i<l; i++) {
        // See: http://bits.stephan-brumme.com/countBits.html for an explanation
        x = values[i];
        if( x == 0 )
            continue;
        x  = x - ((x >> 1) & 0x55555555);
        x  = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        x  = x + (x >> 4);
        x &= 0xF0F0F0F;

        count += (x * 0x01010101) >> 24;
    }
    return count;
}


BitField.prototype.equals = function(other){
    var i,l,count,x,a,b;
    for (i=0,l=this.values.length;i<l; i++) {
        a = this.values[i];
        b = other.values[i];
        a = a === undefined ? 0 : a;
        b = b === undefined ? 0 : b;
        if( a != b )
            return false;
    }
    return true;
};

BitField.prototype.set = function(i, value) {
    var index = (i / 32) | 0;
    var bit = i % 32;
    if( value )
        this.values[index] |= 1 << bit;
    else
        this.values[index] &= ~(1 << bit);
    return this;
};

BitField.prototype.get = function(i, values){
    values = values || this.values;
    var index = (i / 32) | 0; // | 0 converts to an int. Math.floor works too.
    var bit = i % 32;
    return (values[index] & (1 << bit)) !== 0;
}

/**
*   If no results instance is passed the function returns true
*   if the two bitfields pass the AND
*
*   if equals is passed the result is (a&b) == a
*/
BitField.prototype.and = function( result, other, equals ){
    var i,l;
    var out = result ? result.values : [];
    var values = this.values;
    var ovalues = other.values;
    var evalues = equals ? equals.values : null;
    var eq = true;
    for (i=0,l=values.length;i<l; i++) {
        out[i] = (values[i] & ovalues[i]);
        if( equals && eq ) eq = (out[i] == evalues[i]);
        else if( eq ) eq = (out[i] == 0)
    }
    if( equals )
        return eq;
    if( result )
        return result;
    return !eq;
}


BitField.prototype.toArray = function ( values ){
    var i,l,v,found = false,result = [];
    values = values || this.values;
    for (i=(values.length*32)-1;i>=0; i--) {
        v = this.get(i, values);
        if( !found )
            found = v;
        if( found )
            result.push( v );
    }
    return result;
}

BitField.prototype.toJSON = function () {
    return JSON.stringify(this.values);
};

BitField.prototype.toString = function( values ){   
    return this.toArray( values ).map(function (value) {
        return value ? '1' : '0';
    }).join('');
}

BitField.prototype.toBinaryString = function(){   
    return this.toArray().map(function (value) {
        return value ? '1' : '0';
    }).reverse().join('');
}

BitField.create = function( values ){
    var result = new BitField();
    if( typeof values === 'string' ){
        var vals = values.split('');
        for( var i=vals.length-1, l=vals.length-1;i>=0;i-- ){
            result.set( l-i, vals[i] == '1' );
        }
    }
    return result;
}

module.exports = BitField;