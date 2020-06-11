import { assert } from 'chai';




function greeting(strings, value1) {
    console.log('Strings:', strings);
    console.log('Value1:', value1);
  }
  




describe('Query', () => {
    it('will', async () => {

        const place = 'World';

        greeting `Hello ${place}!`;


    });
})