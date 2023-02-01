import { formatMetaDocs } from './StatusBar'

describe('formatMetaDocs function that StatusBar used test', () => {

  test('all processing should work well', () => {
    const input = ['a', 'b', '(ab)12.3#<weight>456</weight>\[`123`\]', '', '', '789']
    const output = ['a b (ab)12.3', '123', '']
    expect(formatMetaDocs(input)).toEqual(output)
  });

  test('should process empty array input', () => {
    const input: string[] = []
    const output: string[] = ['']
    expect(formatMetaDocs(input)).toEqual(output)
  });

});

export {}