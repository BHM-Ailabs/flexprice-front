export const USAGE_PAGE_SIZE = 50;
export const usageDay = (value: Date) =>
	`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
export interface UsageFilters {
	from: string;
	to: string;
	workspaceId: string;
	userId: string;
	product: string;
}
export function usageQuery(filters: UsageFilters, offset: number): string {
	const from = new Date(`${filters.from}T00:00:00`);
	const to = new Date(`${filters.to}T00:00:00`);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(filters.from) ||
		!/^\d{4}-\d{2}-\d{2}$/.test(filters.to) ||
		!Number.isFinite(from.valueOf()) ||
		!Number.isFinite(to.valueOf()) ||
		usageDay(from) !== filters.from ||
		usageDay(to) !== filters.to ||
		to < from
	)
		throw new Error('Choose a valid date range, with the end date on or after the start date.');
	// Account uses an exclusive upper bound. Include the selected end date in
	// full, including its final millisecond, by sending the following midnight.
	to.setDate(to.getDate() + 1);
	if (to.getTime() - from.getTime() > 93 * 86400000) throw new Error('Choose a date range of up to 93 days.');
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new Error('Invalid page offset.');
	const params = new URLSearchParams({
		from: from.toISOString(),
		to: to.toISOString(),
		limit: String(USAGE_PAGE_SIZE),
		offset: String(offset),
	});
	for (const key of ['workspaceId', 'userId', 'product'] as const) {
		const value = filters[key].trim();
		if (value.length > 160) throw new Error('Filters must be no more than 160 characters.');
		if (value) params.set(key, value);
	}
	return `/usage?${params}`;
}
