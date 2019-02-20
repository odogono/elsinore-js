import { deepClone } from '../../src/util/deep_clone';

describe('deepClone', () => {
    it('should clone objects', () => {
        let obj = { foo: { bar: 'baz' } };
        expect(deepClone(obj)).toEqual(obj);
    });

    it('should clone arrays', () => {
        let arr = [{ foo: 'bar' }, 'baz'];
        expect(arr).toEqual(arr);
    });
});
