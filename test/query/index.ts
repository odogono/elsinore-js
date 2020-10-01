import { suite } from 'uvu';
import assert from 'uvu/assert';




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