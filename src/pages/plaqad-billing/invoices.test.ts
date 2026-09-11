import { describe, expect, it } from 'vitest';
import { invoiceMoney, parseAmountMinor, paymentLink, reviewRecipients } from './invoices';

describe('prepaid invoice money and links', () => {
	it('preserves the approved naira quote exactly', () => {
		expect(parseAmountMinor('331494.06')).toBe(33149406);
		expect(invoiceMoney(33149406, 'NGN')).toBe('₦331,494.06');
		expect(parseAmountMinor('1.01')).toBe(101);
		for (const value of ['0', '-1', '331494.061', '1e5', '1000000000.01']) expect(() => parseAmountMinor(value)).toThrow();
	});
	it('accepts only secure provider checkout links', () => {
		expect(paymentLink('https://checkout.paystack.com/abc')).toBe('https://checkout.paystack.com/abc');
		for (const value of [
			'javascript:alert(1)',
			'https://paystack.com.evil.test/abc',
			'http://checkout.paystack.com/abc',
			'https://user@checkout.paystack.com/abc',
			null,
		])
			expect(paymentLink(value)).toBeNull();
	});
	it('prevents accidental review delivery to the customer', () => {
		expect(reviewRecipients('REVIEW@example.com; review@example.com', 'customer@example.com')).toEqual(['review@example.com']);
		expect(() => reviewRecipients('Customer@example.com', 'customer@example.com')).toThrow(/customer/i);
	});
});
