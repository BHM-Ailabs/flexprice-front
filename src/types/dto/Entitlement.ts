import {
	Entitlement,
	ENTITLEMENT_ENTITY_TYPE,
	ENTITLEMENT_USAGE_RESET_PERIOD,
	Pagination,
	Plan,
	Addon,
	Feature,
	FEATURE_TYPE,
} from '@/models';
import { QueryFilter, TimeRangeFilter } from './base';
import { TypedBackendFilter, TypedBackendSort } from '@/types/formatters/QueryBuilder';

// ============================================
// Entitlement Filter Types (matches backend structure)
// ============================================

export interface EntitlementFilter extends Omit<QueryFilter, 'sort'>, TimeRangeFilter {
	// Complex filtering support (matches backend Filters field)
	filters?: TypedBackendFilter[];
	sort?: TypedBackendSort[];

	// Entity-specific filters (matches backend)
	entity_type?: ENTITLEMENT_ENTITY_TYPE;
	entity_ids?: string[];
	feature_ids?: string[];
	feature_type?: FEATURE_TYPE;
	is_enabled?: boolean;
	plan_ids?: string[];
}

// Legacy alias for backward compatibility
export type EntitlementFilters = EntitlementFilter;

// ============================================
// Entitlement Response Types
// ============================================

export interface EntitlementResponse extends Entitlement {
	feature: Feature;
	plan?: Plan;
	addon?: Addon;
}

export interface ListEntitlementsResponse {
	items: EntitlementResponse[];
	pagination: Pagination;
}

// ============================================
// Entitlement Request Types
// ============================================

export interface CreateEntitlementRequest {
	plan_id?: string;
	feature_id: string;
	feature_type: FEATURE_TYPE;
	is_enabled?: boolean;
	usage_limit?: number | null;
	usage_reset_period?: ENTITLEMENT_USAGE_RESET_PERIOD;
	is_soft_limit?: boolean;
	static_value?: string;
	config_value?: Record<string, unknown>;
	grant_measure?: 'quantity' | 'amount';
	grant_duration_value?: number;
	grant_duration_unit?: 'hour' | 'day' | 'week';
	grant_quota?: string;
	aggregation_mode?: 'additive' | 'parallel';
	entity_type: ENTITLEMENT_ENTITY_TYPE;
	entity_id: string;
}

export interface UpdateEntitlementRequest {
	plan_id?: string;
	feature_id?: string;
	feature_type?: FEATURE_TYPE;
	is_enabled?: boolean;
	usage_limit?: number | null;
	usage_reset_period?: ENTITLEMENT_USAGE_RESET_PERIOD;
	is_soft_limit?: boolean;
	static_value?: string;
	config_value?: Record<string, unknown>;
	grant_measure?: 'quantity' | 'amount';
	grant_duration_value?: number;
	grant_duration_unit?: 'hour' | 'day' | 'week';
	grant_quota?: string;
	aggregation_mode?: 'additive' | 'parallel';
	clear_grant_config?: boolean;
	entity_type?: ENTITLEMENT_ENTITY_TYPE;
	entity_id?: string;
}

export interface CreateBulkEntitlementRequest {
	items: CreateEntitlementRequest[];
}

export interface CreateBulkEntitlementResponse {
	items: EntitlementResponse[];
}
