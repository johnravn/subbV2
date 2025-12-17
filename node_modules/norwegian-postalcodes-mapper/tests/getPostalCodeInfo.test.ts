import { getPostalCodeInfo } from '../dist/index';

describe('Postal code information retrieval', () => {
  test('Known city is correct', () => {
    const result = getPostalCodeInfo('2007');
    // Assert that the result is defined before checking its properties
    expect(result).toBeDefined();
    // Assuming result is now known to be defined, check the city
    expect(result!.city).toBe('KJELLER');
  });

  test('Known municipality is correct', () => {
    const result = getPostalCodeInfo('2007');
    // Assert that the result is defined before checking its properties
    expect(result).toBeDefined();
    // Assuming result is now known to be defined, check the municipality
    expect(result!.municipality).toBe('LILLESTRØM');
  });

  test('Unknown postal code returns undefined', () => {
    // Directly check for undefined since this is the unhappy path
    const result = getPostalCodeInfo('asdb');
    expect(result).toBeUndefined();
  });
});

