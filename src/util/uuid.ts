// BEGIN Math.uuid.js

/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. 
 *   // (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
const CHARS = (
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'abcdefghijklmnopqrstuvwxyz'
  ).split('');
  
  function getValue(radix:number) :number {
      return 0 | Math.random() * radix;
  }
  

  /**
   * 
   */
  function generateUUID() { // Public Domain/MIT
    var d = new Date().getTime();//Timestamp
    //Time in microseconds since page-load or 0 if unsupported
    var d2 = (performance && performance.now && (performance.now()*1000)) || 0;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16;//random number between 0 and 16
        if(d > 0){//Use timestamp until depleted
            r = (d + r)%16 | 0;
            d = Math.floor(d/16);
        } else {//Use microseconds since page-load if supported
            r = (d2 + r)%16 | 0;
            d2 = Math.floor(d2/16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

  export function createUUID(len:number=undefined, radix:number=CHARS.length) : string {
      let out = '';
      let i = -1;
  
      if (len !== undefined ) {
        // Compact form
          while (++i < len) {
              out += CHARS[getValue(radix)];
          }
          return out;
      }
      
      // rfc4122, version 4 form
      // Fill in random data.  At i==19 set the high bits of clock sequence as
      // per rfc4122, sec. 4.1.5
      while (++i < 36) {
          switch (i) {
              case 8:
              case 13:
              case 18:
              case 23:
                  out += '-';
                  break;
              case 19:
                  out += CHARS[(getValue(16) & 0x3) | 0x8];
                  break;
              default:
                  out += CHARS[getValue(16)];
          }
      }
  
      return out;
  }