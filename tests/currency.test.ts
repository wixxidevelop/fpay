import { userRegistrationSchema, userUpdateSchema } from '@/lib/validations';
import { getCurrencySymbol, isValidCurrency } from '@/lib/currencies';

describe('Currency validation', () => {
  test('accepts valid ISO codes and uppercases input', () => {
    const parsed = userRegistrationSchema.parse({
      email: 'a@b.com',
      username: 'user_1',
      password: 'password123',
      preferredCurrency: 'eur',
    });
    expect(parsed.preferredCurrency).toBe('EUR');
  });

  test('defaults to USD when not provided', () => {
    const parsed = userRegistrationSchema.parse({
      email: 'a@b.com',
      username: 'user_2',
      password: 'password123',
    });
    expect(parsed.preferredCurrency).toBe('USD');
  });

  test('rejects invalid codes', () => {
    const result = userRegistrationSchema.safeParse({
      email: 'a@b.com',
      username: 'user_3',
      password: 'password123',
      preferredCurrency: 'XYZ',
    });
    expect(result.success).toBe(false);
  });
});

describe('Currency symbol lookup', () => {
  test('returns symbol for known code', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
  });

  test('falls back to code if unknown', () => {
    expect(getCurrencySymbol('ABC')).toBe('ABC');
  });
});

