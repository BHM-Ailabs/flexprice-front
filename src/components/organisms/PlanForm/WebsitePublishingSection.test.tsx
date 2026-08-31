import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WebsitePublishingSection from './WebsitePublishingSection';

vi.mock('@/core/services/supbase/config', () => ({ default: {} }));
vi.mock('@/core/auth/AuthService', () => ({ default: {} }));

describe('WebsitePublishingSection', () => {
	it('defaults new plans to the private enterprise audience', () => {
		render(<WebsitePublishingSection onChange={vi.fn()} />);

		expect(screen.getByRole('radio', { name: /private enterprise plan/i })).toBeChecked();
		expect(screen.queryByText('Product pages')).not.toBeInTheDocument();
	});

	it('publishes through the audience control without metadata entry', () => {
		const onChange = vi.fn();
		render(<WebsitePublishingSection metadata={{ contract_reference: 'ENT-1042' }} onChange={onChange} />);

		fireEvent.click(screen.getByRole('radio', { name: /public website plan/i }));

		expect(onChange).toHaveBeenCalledWith({ contract_reference: 'ENT-1042', public: 'true' });
	});

	it('stores no more than five ordered public highlights', () => {
		const onChange = vi.fn();
		render(<WebsitePublishingSection metadata={{ public: 'true' }} onChange={onChange} />);

		fireEvent.change(screen.getByPlaceholderText(/1 monitored brand/i), {
			target: { value: 'First\nSecond\nThird\nFourth\nFifth\nSixth' },
		});

		expect(onChange).toHaveBeenLastCalledWith({
			public: 'true',
			website_features: JSON.stringify(['First', 'Second', 'Third', 'Fourth', 'Fifth']),
		});
	});
});
