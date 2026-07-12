import { describe, expect, it } from "vitest";
import { createFoodSchema, decimalString, positiveDecimalString } from "./food-input";
import { z } from 'zod';

describe('decimalString', () => {
  it.each([
    '0', '12', '12.5', '001.005'
  ])('accepts a non-negative decimal: "%s"', (input) => {
    expect(decimalString(3).parse(input)).toBe(input);
  });

  it('trims surrounding whitespace', () => {
    expect(decimalString(3).parse(' 12.5     ')).toBe('12.5');
  });

  it.each([
    '',
    '   ',
    '-1',
    '+1',
    '.5',
    '1.',
    '1e3',
    '1,000',
    'NaN',
    'Infinity'
  ])('rejects invalid decimal syntax: %s', (input) => {
    expect(decimalString(3).safeParse(input).success).toBe(false);
  });

  it('rejects excessive precision', () => {
    const result = decimalString(3).safeParse('1.2345');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: 'Must have at most 3 fractional digits'
        })
      );
    }
  });

  it('can enforce whole-number input', () => {
    expect(decimalString(0).parse('450')).toBe('450');
    expect(decimalString(0).safeParse('1.5').success).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN])(
    'rejects invalid precision configuration: %s',
    (maxFractionalDigits) => {
      expect(() => decimalString(maxFractionalDigits)).toThrow(
        new RangeError(
          'Maximum fractional digits must be a non-negative integer'
        )
      );
    }
  );
});

describe('positiveDecimalString', () => {
  it.each([
    '1',
    '0.001',
    '12.5'
  ])('accepts a positive decimal: %s', (input) => {
    expect(positiveDecimalString(3).parse(input)).toBe(input);
  });

  it.each([
    '0',
    '0.0',
    '000.000'
  ])('rejects zero: %s', (input) => {
    const result = positiveDecimalString(3).safeParse(input);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: 'Must be greater than zero'
        })
      );
    }
  });
});

describe('createFoodSchema', () => {
  it('validates a solid food and supplies optional default', () => {
    const result = createFoodSchema.parse({
      name: '    5% Lean Steak Mince   ',
      amountUnit: 'mg',
      basisAmount: '250',
      energyKcal: '342',
      proteinG: '52.5',
      carbsG: '0',
      fatG: '12.5'
    });

    expect(result).toEqual({
      name: '5% Lean Steak Mince',
      brand: '',
      barcode: '',
      amountUnit: 'mg',
      basisAmount: '250',
      servingAmount: '',
      containerAmount: '',
      energyKcal: '342',
      proteinG: '52.5',
      carbsG: '0',
      fatG: '12.5',
      fibreG: '',
      sugarG: '',
      saturatedFatG: '',
      sodiumMg: '',
      potassiumMg: '',
      notes: ''
    });
  });

  it('validates a fractional liquid food', () => {
    const result = createFoodSchema.parse({
      name: 'Whole milk',
      brand: ' Dairy Farm ',
      barcode: '001234567890',
      amountUnit: 'ul',
      basisAmount: '250.125',
      servingAmount: '12.5',
      containerAmount: '1000',
      energyKcal: '160.5',
      proteinG: '8.2',
      carbsG: '12',
      fatG: '8.5',
      sodiumMg: '95',
      notes: ' Keep refrigerated '
    });

    expect(result.amountUnit).toBe('ul');
    expect(result.basisAmount).toBe('250.125');
    expect(result.servingAmount).toBe('12.5');
    expect(result.brand).toBe('Dairy Farm');
    expect(result.barcode).toBe('001234567890');
    expect(result.sodiumMg).toBe('95');
    expect(result.notes).toBe('Keep refrigerated');
  });

  it('rejects zero basis, serving, and container amounts', () => {
    const result = createFoodSchema.safeParse({
      name: 'Invalid food',
      amountUnit: 'mg',
      basisAmount: '0',
      servingAmount: '0.0',
      containerAmount: '000.000',
      energyKcal: '0',
      proteinG: '0',
      carbsG: '0',
      fatG: '0'
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = z.flattenError(result.error).fieldErrors;

      expect(errors.basisAmount).toContain('Must be greater than zero');
      expect(errors.servingAmount).toContain('Must be greater than zero');
      expect(errors.containerAmount).toContain('Must be greater than zero');
    }
  });

  it('rejects excessive precision and fractional whole-mg nutrients', () => {
    const result = createFoodSchema.safeParse({
      name: 'Invalid precision',
      amountUnit: 'ul',
      basisAmount: '250.1234',
      energyKcal: '100.1234',
      proteinG: '5',
      carbsG: '10',
      fatG: '2',
      sodiumMg: '95.5'
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = z.flattenError(result.error).fieldErrors;

      expect(errors.basisAmount).toContain(
        'Must have at most 3 fractional digits'
      );
      expect(errors.energyKcal).toContain(
        'Must have at most 3 fractional digits'
      );
      expect(errors.sodiumMg).toContain(
        'Must have at most 0 fractional digits'
      );
    }
  });

  it('rejects an unsupported amount unit', () => {
    const result = createFoodSchema.safeParse({
      name: 'Invalid unit',
      amountUnit: 'ml',
      basisAmount: '250',
      energyKcal: '100',
      proteinG: '5',
      carbsG: '10',
      fatG: '2'
    });

    expect(result.success).toBe(false);
  });
});
