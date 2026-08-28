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
	invoiced?: RevenueDashboardGraphPoint[];
	paid?: RevenueDashboardGraphPoint[];
	voice_minutes?: RevenueDashboardGraphPoint[];
}

export interface RevenueCollectionSummary {
	total_invoiced: number | string;
	total_paid: number | string;
	total_unpaid: number | string;
	total_workspaces: number;
	invoice_count: number;
	paid_invoice_count: number;
	overdue_invoice_count: number;
}

export interface RevenueAgingRow {
	workspace_id: string;
	workspace_name: string;
	current: number | string;
	days_1_30: number | string;
	days_31_60: number | string;
	days_61_90: number | string;
	days_91_plus: number | string;
	total_outstanding: number | string;
}

export interface RevenueLeaderboardItem {
	id: string;
	label: string;
	value: number | string;
}

export interface RevenueLeaderboards {
	apps: RevenueLeaderboardItem[];
	users: RevenueLeaderboardItem[];
	plans: RevenueLeaderboardItem[];
	workspaces: RevenueLeaderboardItem[];
}

export interface RevenueDashboardResponse {
	summaries: Record<string, RevenueDashboardSummary>;
	items: RevenueDashboardItem[];
	collections: Record<string, RevenueCollectionSummary>;
	graphs: Record<string, RevenueDashboardGraph>;
	aging: Record<string, RevenueAgingRow[]>;
	leaderboards: Record<string, RevenueLeaderboards>;
	graph?: RevenueDashboardGraph | null;
}
