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

  test('accepts a variety of world currencies', () => {
    const codes = ['JPY','AUD','CAD','CHF','NZD','SEK','NOK','DKK','BRL','ZAR','TRY','MXN','SGD','HKD','KRW','AED','SAR','THB','IDR','MYR','PHP','PLN','HUF','CZK','RON','ILS','ARS','CLP','COP','PEN','VND','NGN','GHS','EGP','UAH','PKR','TWD','BDT','KWD','QAR','BHD','OMR'];
    for (const code of codes) {
      const parsed = userRegistrationSchema.parse({
        email: `a_${code.toLowerCase()}@b.com`,
        username: `user_${code.toLowerCase()}`,
        password: 'password123',
        preferredCurrency: code,
      });
      expect(parsed.preferredCurrency).toBe(code);
      expect(isValidCurrency(code)).toBe(true);
    }
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

  test('returns symbols for extended set', () => {
    const map: Record<string, string> = {
      JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
      RUB: '₽', BRL: 'R$', ZAR: 'R', TRY: '₺', MXN: '$', SGD: 'S$', HKD: 'HK$', KRW: '₩', AED: 'د.إ', SAR: '﷼',
      THB: '฿', IDR: 'Rp', MYR: 'RM', PHP: '₱', PLN: 'zł', HUF: 'Ft', CZK: 'Kč', RON: 'lei', ILS: '₪',
      ARS: '$', CLP: '$', COP: '$', PEN: 'S/', VND: '₫', NGN: '₦', GHS: '₵', EGP: 'E£', UAH: '₴', PKR: '₨',
    };
    for (const [code, symbol] of Object.entries(map)) {
      expect(getCurrencySymbol(code)).toBe(symbol);
    }
  });
});
