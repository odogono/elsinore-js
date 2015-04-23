'use strict';

var BitField = function () {
    this.values = [];
};

BitField.prototype.reset = function() {
    this.values = [];
};

BitField.prototype.clone = function() {
    var result = BitField.create();
    result.setValues( this.toValues() );
    return result;
};

BitField.prototype.size = function() {
    return this.values.length * 32;
};

BitField.prototype.count = function( values ){
    var i,l,count,x;
    values = values || this.values;
    if( this.all ){
        return Number.MAX_VALUE;
    }
    if( this.values.length === 0 ){
        return 0;
    }
    count = 0;
    for (i=0,l=values.length; i<l; i++ ) {
        // See: http://bits.stephan-brumme.com/countBits.html for an explanation
        x = values[i];

        if( x === 0 ){
            continue;
        }
        x  = x - ((x >> 1) & 0x55555555);
        x  = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        x  = x + (x >> 4);
        x &= 0xF0F0F0F;

        count += (x * 0x01010101) >> 24;
    }
    return count;
};


BitField.prototype.equals = function(other){
    var i,l,a,b;
    
    if( this.all || other.all ){
        if( this.all === other.all ){
            return true;
        }
        return false;
    }
    for (i=0,l=this.values.length;i<l; i++) {
        a = this.values[i];
        b = other.values[i];
        a = a === undefined ? 0 : a;
        b = b === undefined ? 0 : b;
        if( a !== b ){
            return false;
        }
    }
    return true;
};

BitField.prototype.setValues = function(values, value) {
    var i,l;
    this.all = false;
    for( i=0,l=values.length;i<l;i++ ){
        this.set( values[i], value );
    }
    return this;
};

BitField.prototype.set = function(i, value) {
    var index, bit;
    if( i === 'all' ){
        this.all = true;
        return;
    }
    this.all = false;
    index = (i / 32) | 0;
    bit = i % 32;
    if( value ){
        this.values[index] |= 1 << bit;
    }
    else{
        this.values[index] &= ~(1 << bit);
    }
    return this;
};

BitField.prototype.get = function(i, values){
    var bit, index;
    if( this.all ){
        return true;
    }
    values = values || this.values;
    index = (i / 32) | 0; // | 0 converts to an int. Math.floor works too.
    bit = i % 32;
    return (values[index] & (1 << bit)) !== 0;
};

/**
*   If no results instance is passed the function returns true
*   if the two bitfields pass the AND
*
*   if equals is passed the result is (a&b) == a
*/
BitField.prototype.and = function( result, other, equals ){
    var i,l, out, values, ovalues, evalues, eq;
    if( this.all || other.all ){
        return true;
    }
    out = result ? result.values : [];
    values = this.values;
    ovalues = other.values;
    evalues = equals ? equals.values : null;
    eq = true;
    for (i=0,l=values.length;i<l; i++) {
        out[i] = (values[i] & ovalues[i]);
        if( equals && eq ){ 
            eq = (out[i] === evalues[i]);
        }
        else if( eq ){
            eq = (out[i] === 0);
        }
    }
    if( equals ){
        return eq;
    }
    if( result ){
        return result;
    }
    return !eq;
};

BitField.prototype.toValues = function( values ){
    var i,l,result = [];
    values = values || this.values;
    for( i=0,l=(values.length*32);i<l;i++ ){
        if( this.get(i, values) ){
            result.push( i );
        }
    }
    return result;
};

BitField.prototype.toArray = function ( values ){
    var i,v,found,result;
    if( this.all ){
        return [];
    }
    found = false;
    result = [];
    values = values || this.values;
    for (i=(values.length*32)-1;i>=0; i--) {
        v = this.get(i, values);
        if( !found ){
            found = v;
        }
        if( found ){
            result.push( v );
        }
    }
    return result;
};

BitField.prototype.toJSON = function () {
    if( this.all ){
        return 'all';
    }
    return this.toValues();
};

BitField.prototype.toString = function( values ){   
    if( this.all ){
        return 'all';
    }
    if( this.values.length === 0 ){
        return '0';
    }
    return this.toArray( values ).map(function (value) {
        return value ? '1' : '0';
    }).join('');
};

BitField.prototype.toBinaryString = function() {   
    if( this.all ) { 
        return 'all'; // not great...
    }
    if( this.values.length === 0 ){
        return '0';
    }
    return this.toArray().map(function (value) {
        return value ? '1' : '0';
    }).join('');
};

BitField.and = function(a,b){
    var i,l,values,ovalues;
    if( a.all && b.all ){
        return true;
    }
    if( a.values.length === 0 && b.values.length === 0 ){
        return false;
    }

    values = a.values;
    ovalues = b.values;

    // if( d ){
    //     console.log('a ' + a.toJSON() );
    //     console.log('b ' + b.toJSON() );
    // }
    for (i=0,l=values.length;i<l; i++) {
        if( values[i] === undefined ){
            continue;
        }
        // if( d ) console.log( 'bfAND ' + values[i] + ' ' + ovalues[i] + ' ' + (values[i] & ovalues[i]) );
        if( (values[i] & ovalues[i]) !== values[i] ){
            return false;
        }
    }
    return true;
};

BitField.aand = function(a,b,d){
    var i,l,f,values,ovalues;
    if( a.all && b.all ){
        return true;
    }
    if( a.values.length === 0 && b.values.length === 0 ){
        return false;
    }

    values = a.values;
    ovalues = b.values;

    for (i=0,l=values.length;i<l; i++) {
        // if( values[i] === undefined )
        //     continue;
        // if( d ){ console.log( i + ' bfOR ' + values[i] + ' ' + ovalues[i] + ' ' + (values[i] & ovalues[i]) ); }
        if( (values[i] & ovalues[i]) !== 0 ){
            f = true;
        }
    }

    return f;
};

BitField.nor = function(a,b){
    var i,l,values,ovalues;
    if( a.all || b.all ){
        return false;
    }
    if( a.values.length === 0 && b.values.length === 0 ){
        return true;
    }

    values = a.values;
    ovalues = b.values;

    for (i=0,l=values.length;i<l; i++) {
        if( (values[i] & ovalues[i]) !== 0 ){
            return false;
        }
    }
    return true;    
};

BitField.isBitField = function( val ){
    return ( val && typeof val === 'object' && val instanceof BitField );
};

BitField.create = function( values ){
    var vals,i,l,result;
    result = new BitField();
    if( typeof values === 'string' ){
        if( values === 'all' ){
            result.all = true;
        } else {
            vals = values.split('');
            for( i=vals.length-1, l=vals.length-1;i>=0;i-- ){
                result.set( l-i, vals[i] === '1' );
            }
        }
    }
    return result;
};


module.exports = BitField;