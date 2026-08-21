export const PLAQAD_PRODUCT_OPTIONS: { label: string; value: string }[] = [
	{ label: 'Plaqad IQ', value: 'iq' },
	{ label: 'Plaqad BA', value: 'ba' },
	{ label: 'Plaqad Studio', value: 'studio' },
	{ label: 'Plaqad OS', value: 'os' },
	{ label: 'Plaqad PA', value: 'pa' },
	{ label: 'Plaqad Talent', value: 'talent' },
	{ label: 'Plaqad Intel', value: 'intel' },
	{ label: 'Plaqad Scout', value: 'scout' },
	{ label: 'Plaqad People', value: 'people' },
	{ label: 'Plaqad Studio Plus', value: 'maestro' },
];

export const PLAQAD_PRODUCT_LABELS = Object.fromEntries(PLAQAD_PRODUCT_OPTIONS.map((option) => [option.value, option.label])) as Record<
	string,
	string
>;
