import { TutorialItem } from '@/pages';

// all links enum
export enum DOCS_LINKS {
	//features
	FEATURE_CREATE = 'https://docs.flexprice.io/docs/product-catalogue/features/create',
	FEATURE_PLANS = 'https://docs.flexprice.io/docs/product-catalogue/features/linking-to-plans',
	FEATURE_USECASE = 'https://docs.flexprice.io/docs/product-catalogue/features/use-cases',

	//plans
	PLANS_OVERVIEW = 'https://docs.flexprice.io/docs/product-catalogue/plans/overview',
	PLANS_CREATE = 'https://docs.flexprice.io/docs/product-catalogue/plans/create',
	PLANS_CHARGES = 'https://docs.flexprice.io/docs/product-catalogue/plans/charges/advance-vs-arrear',

	//customers
	CUSTOMER_OVERVIEW = 'https://docs.flexprice.io/docs/customers/overview',
	CUSTOMER_ARCHIVE = 'https://docs.flexprice.io/docs/customers/archive',
	SUBSCRIPTION_CREATE = 'https://docs.flexprice.io/docs/subscriptions/customers-create-subscription',

	//invoices
	INVOICE_CREATE = 'https://docs.flexprice.io/api-reference/invoices/create-a-new-one-off-invoice',
	INVOICE_MANAGE = 'https://docs.flexprice.io/api-reference/invoices/update-an-invoice',
	INVOICE_PARTIAL = 'https://docs.flexprice.io/api-reference/payments/create-a-new-payment#create-a-new-payment',

	//payments
	PAYMENT_CREATE = 'https://docs.flexprice.io/api-reference/payments/create-a-new-payment',
	PAYMENT_UPDATE = 'https://docs.flexprice.io/api-reference/payments/update-a-new-payment',
	PAYMENT_DELETE = 'https://docs.flexprice.io/api-reference/payments/delete-a-new-payment',

	//secrets
	SECRET_LIST = 'https://docs.flexprice.io/api-reference/secrets/list-api-keys',
	SECRET_CREATE = 'https://docs.flexprice.io/api-reference/secrets/create-a-new-api-key',
	SECRET_DELETE = 'https://docs.flexprice.io/api-reference/secrets/delete-an-api-key',

	//credit notes
	CREDIT_CREATE = 'https://docs.flexprice.io/api-reference/credit-notes/create-a-new-credit-note',
	CREDIT_PROCESS = 'https://docs.flexprice.io/api-reference/credit-notes/process-a-draft-credit-note',
	CREDIT_VOID = 'https://docs.flexprice.io/api-reference/credit-notes/void-a-credit-note',

	//tasks
	TASK_LIST = 'https://docs.flexprice.io/api-reference/tasks/list-tasks',
	TASK_CREATE = 'https://docs.flexprice.io/api-reference/tasks/create-a-new-task',
	TASK_PROCESS = 'https://docs.flexprice.io/api-reference/tasks/process-a-task',

	//taxes
	TAX_OVERVIEW = 'https://docs.flexprice.io/api-reference/tax-associations/create-tax-associations',
	TAX_TYPES = 'https://docs.flexprice.io/api-reference/tax-associations/get-tax-association',
	TAX_ASSOCIATIONS = 'https://docs.flexprice.io/api-reference/tax-associations/list-tax-associations',

	//groups
	GROUPS = 'https://docs.flexprice.io/docs/product-catalogue/groups/overview',
}

export enum IMAGE_URLS {
	FEATURE_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/FEATURES1_veomrd.svg',
	FEATURE_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180989/Features2_fbd39s.svg',
	FEATURE_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180994/FEATURES_3_drkhb7.svg',

	PLAN_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/PLAN_1_j6tdqv.svg',
	PLAN_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/PLAN_2_oxi9ld.svg',
	PLAN_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180995/PLAN_3_lfh1mi.svg',

	CUSTOMER_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180990/Customer_1_kf0ena.svg',
	CUSTOMER_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180991/Customer_2_ifiaof.svg',
	CUSTOMER_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180987/Customer_3_triyiv.svg',

	INVOICE_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/Invoice_1_lh9ved.svg',
	INVOICE_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180991/invoice_2_v8fa71.svg',
	INVOICE_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180989/iNvoice_3_glq1xo.svg',

	PAYMENT_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753182361/PAYMENTS_1_dgx00f.svg',
	PAYMENT_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753182361/PAYMENTS_2_ugsdxt.svg',
	PAYMENT_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753203616/PAYMENTS_3_erwdgn_gxkrxv.svg',

	SECRET_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753189165/api1_egeb4f.svg',
	SECRET_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753204234/api2_gxkyqw.svg',
	SECRET_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753184051/api3_ahcbx8.svg',

	CREDIT_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180987/CN1_vkg2kh.svg',
	CREDIT_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180988/CN2_gpeaqi.svg',
	CREDIT_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753180987/CN3_kpsfpv.svg',

	TASK_1 = 'https://res.cloudinary.com/daospvham/image/upload/v1753189165/TASK1_cpgjla.svg',
	TASK_2 = 'https://res.cloudinary.com/daospvham/image/upload/v1753182361/TASKS_2_emkpmn.svg',
	TASK_3 = 'https://res.cloudinary.com/daospvham/image/upload/v1753189166/TASKS_3_k2nkyu.svg',
}

const openGuide = (url: string) => {
	window.open(url, '_blank');
};

const GUIDES: Record<
	string,
	{
		tutorials: TutorialItem[];
	}
> = {
	features: {
		tutorials: [
			{
				imageUrl: IMAGE_URLS.FEATURE_1,
				title: 'How to create a feature?',
				description: 'Explore how features work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.FEATURE_CREATE),
			},
			{
				imageUrl: IMAGE_URLS.FEATURE_2,
				title: 'How to link features to plans?',
				description: 'Link features to plans in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.FEATURE_PLANS),
			},
			{
				imageUrl: IMAGE_URLS.FEATURE_3,
				title: 'How to clone open ai pricing?',
				description: 'Clone open ai / cursor style pricing in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.FEATURE_USECASE),
			},
		],
	},
	addons: {
		tutorials: [
			{
				imageUrl: 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/PLAN_1_j6tdqv.svg',
				title: 'How to create an Addon?',
				description: 'Explore how to create a new Addons in Plaqad BSP.',
				onClick: () => openGuide('https://docs.flexprice.io/api-reference/addons/create-addon'),
			},
			{
				imageUrl: 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/PLAN_2_oxi9ld.svg',
				title: 'How to list all Addons?',
				description: 'Explore how to list all Addons.',
				onClick: () => openGuide('https://docs.flexprice.io/api-reference/addons/list-addons'),
			},
			{
				imageUrl: 'https://res.cloudinary.com/daospvham/image/upload/v1753180995/PLAN_3_lfh1mi.svg',
				title: 'How to delete an Addon?',
				description: 'Explore how to delete a Addon.',
				onClick: () => openGuide('https://docs.flexprice.io/api-reference/addons/delete-addon'),
			},
		],
	},
	coupons: {
		tutorials: [
			{
				imageUrl: 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/PLAN_1_j6tdqv.svg',
				title: 'How to create a coupon?',
				description: 'Explore how to create a new Coupon in Plaqad BSP.',
				onClick: () => openGuide('https://docs.flexprice.io/api-reference/coupons/create-a-new-coupon'),
			},
			{
				imageUrl: 'https://res.cloudinary.com/daospvham/image/upload/v1753180993/PLAN_2_oxi9ld.svg',
				title: 'How to update a coupon?',
				description: 'Explore how to update a Coupon.',
				onClick: () => openGuide('https://docs.flexprice.io/api-reference/coupons/update-a-coupon'),
			},
			{
				imageUrl: 'https://res.cloudinary.com/daospvham/image/upload/v1753180995/PLAN_3_lfh1mi.svg',
				title: 'How to delete a coupon?',
				description: 'Explore how to delete a Coupon.',
				onClick: () => openGuide('https://docs.flexprice.io/api-reference/coupons/delete-a-coupon'),
			},
		],
	},
	plans: {
		tutorials: [
			{
				imageUrl: IMAGE_URLS.PLAN_1,
				title: 'Explore how plans work in Plaqad BSP.',
				description: 'Explore how plans work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.PLANS_OVERVIEW),
			},
			{
				title: 'How to create a plan',
				imageUrl: IMAGE_URLS.PLAN_2,
				description: 'Create a new plan in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.PLANS_CREATE),
			},
			{
				imageUrl: IMAGE_URLS.PLAN_3,
				title: 'How to choose between advance and arrear billing?',
				description: 'Understand billing models used in plans.',
				onClick: () => openGuide(DOCS_LINKS.PLANS_CHARGES),
			},
		],
	},
	groups: {
		tutorials: [
			{
				imageUrl: IMAGE_URLS.PLAN_3,
				title: 'Explore how groups work in Plaqad BSP.',
				description: 'Learn how groups work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.GROUPS),
			},
			{
				imageUrl: IMAGE_URLS.PLAN_1,
				title: 'Explore how plans work in Plaqad BSP.',
				description: 'Explore how plans work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.PLANS_OVERVIEW),
			},
			{
				imageUrl: IMAGE_URLS.FEATURE_1,
				title: 'Explore how features work in Plaqad BSP.',
				description: 'Explore how features work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.FEATURE_CREATE),
			},
		],
	},
	customers: {
		tutorials: [
			{
				title: 'How to create a customer',
				description: 'Explore how customers work in Plaqad BSP.',
				imageUrl: IMAGE_URLS.CUSTOMER_1,
				onClick: () => openGuide(DOCS_LINKS.CUSTOMER_OVERVIEW),
			},
			{
				title: 'How to archive a customer',
				imageUrl: IMAGE_URLS.CUSTOMER_2,
				description: 'Create a new customer in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.CUSTOMER_ARCHIVE),
			},
			{
				title: 'How to create a subscription',
				imageUrl: IMAGE_URLS.CUSTOMER_3,
				description: 'Create a new subscription in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.SUBSCRIPTION_CREATE),
			},
		],
	},
	invoices: {
		tutorials: [
			{
				title: 'How to create an invoice',
				description: 'Explore how invoices work in Plaqad BSP.',
				imageUrl: IMAGE_URLS.INVOICE_1,
				onClick: () => openGuide(DOCS_LINKS.INVOICE_CREATE),
			},
			{
				title: 'How to manage invoices',
				description: 'Manage invoices in Plaqad BSP.',
				imageUrl: IMAGE_URLS.INVOICE_2,
				onClick: () => openGuide(DOCS_LINKS.INVOICE_MANAGE),
			},
			{
				title: 'How to handle partial payments',
				description: 'Handle partial payments in Plaqad BSP.',
				imageUrl: IMAGE_URLS.INVOICE_3,
				onClick: () => openGuide(DOCS_LINKS.INVOICE_PARTIAL),
			},
		],
	},
	payments: {
		tutorials: [
			{
				title: 'How to create a payment',
				imageUrl: IMAGE_URLS.PAYMENT_1,
				description: 'Explore how payments work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.PAYMENT_CREATE),
			},
			{
				title: 'How to update a payment',
				imageUrl: IMAGE_URLS.PAYMENT_2,
				description: 'Create a payment in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.PAYMENT_UPDATE),
			},
			{
				title: 'How to delete a payment',
				imageUrl: IMAGE_URLS.PAYMENT_3,
				description: 'Delete an existing payment in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.PAYMENT_DELETE),
			},
		],
	},
	secrets: {
		tutorials: [
			{
				title: 'List API Keys',
				imageUrl: IMAGE_URLS.SECRET_1,
				description: 'View all API keys in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.SECRET_LIST),
			},
			{
				title: 'Create a new API Key',
				imageUrl: IMAGE_URLS.SECRET_2,
				description: 'Generate a new API key in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.SECRET_CREATE),
			},
			{
				title: 'Delete an API Key',
				imageUrl: IMAGE_URLS.SECRET_3,
				description: 'Delete an API key in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.SECRET_DELETE),
			},
		],
	},
	creditNotes: {
		tutorials: [
			{
				title: 'Create a new credit note',
				imageUrl: IMAGE_URLS.CREDIT_1,
				description: 'Explore how credit notes work in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.CREDIT_CREATE),
			},
			{
				title: 'Process a draft credit note',
				description: 'Create a new credit note in Plaqad BSP.',
				imageUrl: IMAGE_URLS.CREDIT_2,
				onClick: () => openGuide(DOCS_LINKS.CREDIT_PROCESS),
			},
			{
				title: 'Void a credit note',
				description: 'Manage credit notes in Plaqad BSP.',
				imageUrl: IMAGE_URLS.CREDIT_3,
				onClick: () => openGuide(DOCS_LINKS.CREDIT_VOID),
			},
		],
	},
	importExport: {
		tutorials: [
			{
				title: 'Overview',
				imageUrl: IMAGE_URLS.TASK_1,
				description: 'Explore import and export options in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.TASK_LIST),
			},
			{
				title: 'Import a file',
				imageUrl: IMAGE_URLS.TASK_2,
				description: 'Import a file into Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.TASK_CREATE),
			},
			{
				title: 'Process import task',
				imageUrl: IMAGE_URLS.TASK_3,
				description: 'Process an import task in Plaqad BSP.',
				onClick: () => openGuide(DOCS_LINKS.TASK_PROCESS),
			},
		],
	},
	taxes: {
		tutorials: [
			{
				title: 'How to create a tax rate?',
				description: 'Learn how to set up tax rates for your billing system.',
				onClick: () => openGuide(DOCS_LINKS.TAX_OVERVIEW),
			},
			{
				title: 'Understanding tax types',
				description: 'Explore percentage vs fixed amount tax calculations.',
				onClick: () => openGuide(DOCS_LINKS.TAX_TYPES),
			},
			{
				title: 'Tax associations and overrides',
				description: 'Learn how to apply taxes to specific entities.',
				onClick: () => openGuide(DOCS_LINKS.TAX_ASSOCIATIONS),
			},
		],
	},
};

export default GUIDES;
