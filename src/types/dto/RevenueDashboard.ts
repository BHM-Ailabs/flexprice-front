export interface RevenueDashboardRequest {
	period_start: string;
	period_end: string;
	customer_ids: string[];
	window_size?: 'DAY' | 'MONTH';
}

export interface RevenueDashboardSummary {
	total_revenue: number | string | null;
	total_usage_revenue: number | string | null;
	total_fixed_revenue: number | string | null;
	cpm: number | string | null;
	voice_minutes: number | string | null;
}

export interface RevenueDashboardItem {
	customer_id: string;
	external_customer_id: string;
	customer_name: string;
	currency: string;
	total_revenue?: number | string | null;
	total_usage_revenue: number | string | null;
	total_fixed_revenue: number | string | null;
	cpm?: number | string | null;
	voice_minutes?: number | string | null;
}

export interface RevenueDashboardGraphPoint {
	label: string;
	value: string;
}

export interface RevenueDashboardGraph {
	total_revenue?: RevenueDashboardGraphPoint[];
	voice_minutes?: RevenueDashboardGraphPoint[];
}

export interface RevenueDashboardResponse {
	summaries: Record<string, RevenueDashboardSummary>;
	items: RevenueDashboardItem[];
	graph?: RevenueDashboardGraph | null;
}
