import { describe, expect, it, vi } from 'vitest';
vi.mock('@/core/axios/config', () => ({ default: {} }));
import { validateAISelection } from './AiAttachmentsApi';
describe('attachment selection', () => {
	it('accepts Office, scans and short video formats', () => {
		expect(() =>
			validateAISelection(
				['quote.xlsx', 'scan.pdf', 'image.png', 'clip.mp4'].map((name) => new File(['test'], name)),
				[],
			),
		).not.toThrow();
	});
	it('rejects count, aggregate size, empty and unsupported formats before upload', () => {
		expect(() => validateAISelection([new File(['x'], 'a.pdf')], [1, 1, 1, 1])).toThrow('four');
		expect(() => validateAISelection([new File([new Uint8Array(5 * 1024 * 1024)], 'a.pdf')], [20 * 1024 * 1024])).toThrow('total');
		expect(() => validateAISelection([new File([], 'a.txt')], [])).toThrow('nonempty');
		expect(() => validateAISelection([new File(['x'], 'a.exe')], [])).toThrow('unsupported');
	});
});
