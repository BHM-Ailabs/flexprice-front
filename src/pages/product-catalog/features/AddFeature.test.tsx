import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FeatureDetailsSection } from './AddFeature';

type FeatureDetailsProps = Parameters<typeof FeatureDetailsSection>[0];
const originalScrollIntoView = Element.prototype.scrollIntoView;

const formState: FeatureDetailsProps['formState'] = {
	showDescription: false,
	showLookupKey: false,
	showGroup: false,
	showUnitName: false,
	showReportingUnitName: false,
	showEventFilters: false,
	showBucketSize: false,
	showGroupBy: false,
};

beforeAll(() => {
	Object.defineProperty(Element.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn(),
	});
	vi.stubGlobal(
		'ResizeObserver',
		class ResizeObserver {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

afterAll(() => {
	if (originalScrollIntoView) {
		Object.defineProperty(Element.prototype, 'scrollIntoView', {
			configurable: true,
			value: originalScrollIntoView,
		});
	} else {
		delete (Element.prototype as Partial<Element>).scrollIntoView;
	}
	vi.unstubAllGlobals();
});

const renderFeatureDetails = (product = '', operation = '') => {
	const onUpdateFeature = vi.fn();
	const props: FeatureDetailsProps = {
		data: {
			metadata: {
				plaqad_product: product,
				plaqad_operation: operation,
			},
		},
		errors: {},
		formState,
		onUpdateFeature,
		onUpdateFormState: vi.fn(),
	};

	return { ...render(<FeatureDetailsSection {...props} />), onUpdateFeature };
};

describe('FeatureDetailsSection operation selector', () => {
	it('waits for a product before enabling operation selection', () => {
		renderFeatureDetails();

		expect(screen.getByRole('button', { name: 'Select a product first' })).toBeDisabled();
		expect(screen.getByText('Select a product to see its registered operational keys.')).toBeInTheDocument();
	});

	it('shows and filters all Intel operational keys', () => {
		const { onUpdateFeature } = renderFeatureDetails('intel');

		expect(screen.getByText('101 operational keys registered for Plaqad Intel.')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Select operation' }));
		fireEvent.change(screen.getByPlaceholderText('Search Plaqad Intel operations...'), { target: { value: 'crisis_score' } });
		fireEvent.click(screen.getByText('crisis_score'));

		expect(onUpdateFeature).toHaveBeenCalledWith({
			metadata: { plaqad_product: 'intel', plaqad_operation: 'crisis_score' },
			lookup_key: 'plaqad:intel:crisis_score',
			meter: undefined,
		});
	});

	it('shows only the selected product operation registry', () => {
		renderFeatureDetails('talent');

		expect(screen.getByText('8 operational keys registered for Plaqad Talent.')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Select operation' }));
		expect(screen.getByText('cv_parse')).toBeInTheDocument();
		expect(screen.queryByText('crisis_score')).not.toBeInTheDocument();
	});
});
