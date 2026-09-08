type ModelContextNavigator = Navigator & {
	modelContext?: {
		provideContext: (ctx: { tools: unknown[] }) => void;
	};
};

export function registerWebMCPTools() {
	if (typeof navigator === 'undefined') return;
	const nav = navigator as ModelContextNavigator;
	if (!nav.modelContext?.provideContext) return;

	nav.modelContext.provideContext({
		tools: [
			{
				name: 'get_flexprice_app_info',
				description:
					'Returns metadata about the Plaqad BSP dashboard the user is currently viewing: product name, build version, and canonical documentation and API URLs.',
				inputSchema: { type: 'object', properties: {}, additionalProperties: false },
				execute: async () => ({
					name: 'Plaqad BSP Dashboard',
					version: __APP_VERSION__,
					docs: 'https://docs.flexprice.io',
					api: 'https://api.cloud.flexprice.io',
				}),
			},
		],
	});
}
