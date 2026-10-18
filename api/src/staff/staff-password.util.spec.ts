import { describe, expect, it } from 'vitest';
import { generateStaffPassword } from './staff-password.util';

describe('generateStaffPassword', () => {
  it('даёт нужную длину и charset без неоднозначных символов', () => {
    const pw = generateStaffPassword(14);
    expect(pw).toHaveLength(14);
    expect(pw).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]+$/);
  });

  it('не детерминирован', () => {
    const a = generateStaffPassword(20);
    const b = generateStaffPassword(20);
    expect(a).not.toBe(b);
  });
});
