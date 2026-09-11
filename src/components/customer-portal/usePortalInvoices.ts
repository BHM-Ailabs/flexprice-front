import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import { portalInvoicesQueryKey } from './queryKeys';

export const PORTAL_INVOICE_PAGE_SIZE = 25;

/** Search every customer-owned invoice on the server before applying pagination. */
export function usePortalInvoices() {
	const [search, setSearchValue] = useState('');
	const [page, setPage] = useState(1);
	const [debouncedSearch] = useDebounce(search.trim(), 300);
	const query = useQuery({
		queryKey: [...portalInvoicesQueryKey, debouncedSearch, page],
		queryFn: () =>
			CustomerPortalApi.getInvoices({
				limit: PORTAL_INVOICE_PAGE_SIZE,
				page,
				...(debouncedSearch ? { search: debouncedSearch } : {}),
			}),
	});
	return {
		...query,
		search,
		setSearch: (value: string) => {
			setSearchValue(value.slice(0, 200));
			setPage(1);
		},
		page,
		setPage,
		total: query.data?.pagination.total ?? 0,
	};
}
