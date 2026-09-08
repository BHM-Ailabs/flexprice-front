import AIAttachments from '@/components/organisms/AIAttachments';
import { useAIAttachments } from '@/hooks/useAIAttachments';
import { useEnvironment } from '@/hooks/useEnvironment';
import useUser from '@/hooks/useUser';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import { RouteNames } from '@/core/routes/Routes';
import { queryClient } from '@/core/services/tanstack/ReactQueryProvider';
import { SIDEBAR_PRICING_PROMO_QUERY_KEY } from '@/hooks/useShouldShowSidebarPricingPromo';
import { parsePricingWithLLM } from '@/api/ai/llm';
import { orchestrateSetup } from '@/api/ai/orchestrator';
import { getSetupProgressSteps } from '@/api/ai/setupProgress';
import { schemaToPricingCardProps } from '@/api/ai/preview';
import { PRICING_TEMPLATES, type TemplateDefinition } from '@/api/ai/templates';
import type { SetupStep, PricingSchema } from '@/api/ai/types';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errorMessage';
import { PricingCard } from '@/components/molecules';
import { Button } from '@/components/ui';

// ============================================
// Progress step labels
// ============================================

const STEP_LABELS: Record<SetupStep, string> = {
	parsing: 'Parsing your pricing...',
	creating_features: 'Setting up features',
	creating_plans: 'Creating plans',
	creating_prices: 'Adding prices',
	creating_entitlements: 'Applying limits',
	creating_credit_grants: 'Adding credits',
	done: 'Finishing up…',
};

/** Template previews skip the API but show a longer “working” moment before cards (custom prompt stays LLM-paced). */
const TEMPLATE_PREVIEW_DELAY_MS = 6000;

/** Preview canvas shimmer: custom prompt (LLM) — shorter reveal. */
const PREVIEW_SHIMMER_FADE_MS = 2400;
const PREVIEW_SHIMMER_END_MS = 3050;

/** Template path — longer shimmer so the reveal feels earned. */
const PREVIEW_SHIMMER_FADE_TEMPLATE_MS = 3800;
const PREVIEW_SHIMMER_END_TEMPLATE_MS = 5200;

/** After setup succeeds, brief pause so the toast is visible before navigating to Plans. */
const POST_SETUP_NAVIGATE_DELAY_MS = 1000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Phase = 'input' | 'preview' | 'creating';

// ============================================
// Component
// ============================================

const PricingSetupPage = () => {
	const { activeEnvironment } = useEnvironment();
	const { user } = useUser();
	return <PricingSetupContent key={`${user?.id}:${user?.tenant?.id}:${activeEnvironment?.id}`} />;
};
const PricingSetupContent = () => {
	const files = useAIAttachments();
	const navigate = useNavigate();
	const location = useLocation();
	const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
	/** Seed for remounting the uncontrolled textarea (template pick, clear, back from preview). */
	const [promptInputSeed, setPromptInputSeed] = useState('');
	const [promptFieldKey, setPromptFieldKey] = useState(0);
	const [hasPromptText, setHasPromptText] = useState(false);
	const promptRef = useRef<HTMLTextAreaElement | null>(null);
	const lastPromptDraftRef = useRef('');
	/** When true, next preview mount skips shimmer (e.g. returning from failed Create). */
	const skipNextPreviewShimmerRef = useRef(false);
	const [phase, setPhase] = useState<Phase>('input');
	const [schema, setSchema] = useState<PricingSchema | null>(null);
	const [isParsing, setIsParsing] = useState(false);
	const [showPreviewShimmer, setShowPreviewShimmer] = useState(false);
	const [fadePreviewShimmer, setFadePreviewShimmer] = useState(false);
	/** Longer preview shimmer only when preview came from a template (not custom LLM parse). */
	const [previewEnteredViaTemplate, setPreviewEnteredViaTemplate] = useState(false);
	const [currentStep, setCurrentStep] = useState<SetupStep | null>(null);
	const [completedSteps, setCompletedSteps] = useState<Set<SetupStep>>(new Set());

	const fromPlans = location.state?.from === 'plans';

	const previewCards = useMemo(() => (schema ? schemaToPricingCardProps(schema) : []), [schema]);

	/** Steps shown during Create — omits limits/credits when the schema has none (matches orchestrator). */
	const setupProgressSteps = useMemo(() => (schema ? getSetupProgressSteps(schema) : []), [schema]);

	useEffect(() => {
		if (phase !== 'preview') {
			setShowPreviewShimmer(false);
			setFadePreviewShimmer(false);
			return;
		}

		if (skipNextPreviewShimmerRef.current) {
			skipNextPreviewShimmerRef.current = false;
			setShowPreviewShimmer(false);
			setFadePreviewShimmer(false);
			return;
		}

		const fadeMs = previewEnteredViaTemplate ? PREVIEW_SHIMMER_FADE_TEMPLATE_MS : PREVIEW_SHIMMER_FADE_MS;
		const endMs = previewEnteredViaTemplate ? PREVIEW_SHIMMER_END_TEMPLATE_MS : PREVIEW_SHIMMER_END_MS;

		// Shimmer + dissolve before reveal (intentional delay)
		setShowPreviewShimmer(true);
		setFadePreviewShimmer(false);
		const t1 = window.setTimeout(() => setFadePreviewShimmer(true), fadeMs);
		const t2 = window.setTimeout(() => {
			setShowPreviewShimmer(false);
			setFadePreviewShimmer(false);
		}, endMs);
		return () => {
			window.clearTimeout(t1);
			window.clearTimeout(t2);
		};
	}, [phase, schema, previewEnteredViaTemplate]);

	// After remounting the uncontrolled prompt field, sync draft ref + send button state.
	useEffect(() => {
		const el = promptRef.current;
		if (!el) return;
		lastPromptDraftRef.current = el.value;
		setHasPromptText(el.value.trim().length > 0);
	}, [promptFieldKey, promptInputSeed]);

	const handleTemplateClick = (tpl: TemplateDefinition) => {
		const text = tpl.displayPrompt ?? '';
		lastPromptDraftRef.current = text;
		setSelectedTemplate(tpl);
		setPromptInputSeed(text);
		setPromptFieldKey((k) => k + 1);
	};

	const handleClearTemplate = () => {
		lastPromptDraftRef.current = '';
		setSelectedTemplate(null);
		setPromptInputSeed('');
		setPromptFieldKey((k) => k + 1);
	};

	/** Uncontrolled textarea: use onInput so typing works reliably across browsers; mirror draft to ref for parse/back. */
	const handlePromptInput = () => {
		const el = promptRef.current;
		if (!el) return;
		const next = el.value;
		lastPromptDraftRef.current = next;
		setHasPromptText(next.trim().length > 0);
		const templateText = (selectedTemplate?.displayPrompt ?? '').trim();
		if (selectedTemplate && next.trim() !== templateText) {
			setSelectedTemplate(null);
		}
	};

	const handleParseAndPreview = async () => {
		const raw = promptRef.current?.value ?? lastPromptDraftRef.current;
		const promptText = raw.trim() || (files.ids.length ? 'Create a pricing preview from the attached files.' : '');
		if (files.blocked) return;
		if (!promptText) {
			toast.error('Please enter a pricing description first.');
			return;
		}
		lastPromptDraftRef.current = raw;
		if (selectedTemplate && !files.items.length) {
			setIsParsing(true);
			try {
				setPreviewEnteredViaTemplate(true);
				skipNextPreviewShimmerRef.current = false;
				await delay(TEMPLATE_PREVIEW_DELAY_MS);
				setSchema(selectedTemplate.schema);
				setFadePreviewShimmer(false);
				setShowPreviewShimmer(true);
				setPhase('preview');
			} finally {
				setIsParsing(false);
			}
			return;
		}
		setIsParsing(true);
		try {
			setPreviewEnteredViaTemplate(false);
			skipNextPreviewShimmerRef.current = false;
			const parsed = await parsePricingWithLLM(promptText, files.ids);
			setSchema(parsed);
			setFadePreviewShimmer(false);
			setShowPreviewShimmer(true);
			setPhase('preview');
		} catch (err) {
			toast.error(getErrorMessage(err));
		} finally {
			setIsParsing(false);
		}
	};

	const handleConfirmCreate = async () => {
		if (!schema) return;
		const stepOrder: SetupStep[] = [...getSetupProgressSteps(schema), 'done'];
		setPhase('creating');
		setCompletedSteps(new Set());
		setCurrentStep(stepOrder[0]);
		try {
			await orchestrateSetup(schema, (step) => {
				const stepIndex = stepOrder.indexOf(step);
				if (stepIndex < 0) return;
				setCompletedSteps(() => {
					const next = new Set<SetupStep>();
					for (let i = 0; i < stepIndex; i++) next.add(stepOrder[i]);
					return next;
				});
				setCurrentStep(step);
			});
			setCompletedSteps(new Set(stepOrder));
			toast.success('Your pricing has been set up!');
			void queryClient.invalidateQueries({ queryKey: [SIDEBAR_PRICING_PROMO_QUERY_KEY], exact: false });
			window.setTimeout(() => navigate(RouteNames.plan), POST_SETUP_NAVIGATE_DELAY_MS);
		} catch (err) {
			toast.error(getErrorMessage(err));
			skipNextPreviewShimmerRef.current = true;
			setPhase('preview');
			setCurrentStep(null);
		}
	};

	const handleBack = () => {
		const draft = lastPromptDraftRef.current;
		setPhase('input');
		setSchema(null);
		setPreviewEnteredViaTemplate(false);
		setPromptInputSeed(draft);
		setPromptFieldKey((k) => k + 1);
	};

	const handleSkip = () => {
		navigate(fromPlans ? RouteNames.plan : RouteNames.homeDashboard);
	};

	const activeStepIdx = currentStep && currentStep !== 'done' ? setupProgressSteps.indexOf(currentStep) : -1;

	const creatingStatusLabel =
		currentStep === 'done'
			? STEP_LABELS.done
			: activeStepIdx >= 0 && setupProgressSteps[activeStepIdx]
				? STEP_LABELS[setupProgressSteps[activeStepIdx]]
				: null;

	return (
		<div className='fixed inset-0 z-50 overflow-y-auto overflow-x-hidden'>
			<div
				className='pointer-events-none absolute inset-0 z-0'
				style={{
					backgroundImage: `url("/assets/v4bgagentic.png")`,
					backgroundSize: 'cover',
					backgroundPosition: 'center',
				}}
				aria-hidden
			/>

			{(phase === 'input' || phase === 'preview') && (
				<button
					type='button'
					onClick={handleSkip}
					aria-label='Close and return to dashboard'
					className={cn(
						'absolute right-3 top-3 z-[55] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
						'border border-gray-200/90 bg-white/85 text-gray-500 shadow-sm backdrop-blur-sm',
						'transition-all hover:scale-105 hover:border-gray-300 hover:bg-white hover:text-gray-800 hover:shadow-md',
						'active:scale-95 sm:right-5 sm:top-5 sm:h-10 sm:w-10',
					)}>
					<X className='h-4 w-4 sm:h-[18px] sm:w-[18px]' strokeWidth={2.25} aria-hidden />
				</button>
			)}

			<div
				className={cn(
					'relative z-10 flex w-full flex-col items-center px-4 sm:px-6',
					phase === 'preview' ? 'min-h-screen justify-center py-10 sm:py-12' : 'min-h-screen justify-center py-16',
				)}>
				{phase === 'input' && isParsing && (
					<div className='fixed inset-0 z-[60] flex items-center justify-center bg-white/50' role='status' aria-live='polite'>
						<div className='flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-md ring-1 ring-gray-200/80'>
							<Loader2 className='h-5 w-5 shrink-0 animate-spin text-indigo-600' aria-hidden />
							<span className='analyzing-prompt-shimmer text-sm font-medium'>Analyzing prompt..</span>
						</div>
					</div>
				)}

				{/* ── Phase: input ─────────────────────────────────────── */}
				{phase === 'input' && (
					<div className='relative z-10 w-full min-w-0 max-w-3xl'>
						{/* Header */}
						<div className='mb-8 text-center'>
							<h1 className='text-[2rem] font-medium tracking-tight text-gray-900'>Set up your pricing</h1>
							<p className='mt-2.5 text-[15px] text-gray-600'>Describe your pricing, attach a price list, or start from a template.</p>
						</div>

						{/* Template badge */}
						{selectedTemplate && (
							<div className='mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 backdrop-blur-sm'>
								<span className='text-sm text-gray-700'>
									{selectedTemplate.iconSrc ? (
										<img
											src={selectedTemplate.iconSrc}
											alt={`${selectedTemplate.label} logo`}
											className='mr-2 inline-block h-4 w-4 object-contain align-[-2px]'
										/>
									) : (
										<span className='mr-1.5 text-base'>{selectedTemplate.icon}</span>
									)}
									Using <span className='font-semibold text-gray-900'>{selectedTemplate.label}</span> template
								</span>
								<button
									type='button'
									onClick={handleClearTemplate}
									aria-label='Clear template'
									className='ml-3 rounded-lg p-1 text-gray-500 transition-colors hover:text-gray-900'>
									<X className='h-3.5 w-3.5' />
								</button>
							</div>
						)}

						{/* Textarea card */}
						<div className='relative z-10 rounded-2xl border border-gray-300 bg-white shadow-sm focus-within:border-black focus-within:ring-2 focus-within:ring-black/10'>
							<textarea
								key={promptFieldKey}
								ref={promptRef}
								placeholder='My app has a free plan and a pro plan at $20/month with 500 API calls included…'
								defaultValue={promptInputSeed}
								onInput={handlePromptInput}
								autoComplete='off'
								autoCorrect='off'
								spellCheck
								rows={5}
								disabled={isParsing}
								className='relative z-10 w-full resize-none rounded-t-2xl bg-transparent px-5 pt-3 text-[15px] leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-60'
							/>
							<div className='border-t border-gray-100 px-4 py-3'>
								<AIAttachments files={files} disabled={isParsing} />
							</div>
							<div className='flex items-center justify-end border-t border-gray-100 px-4 py-3'>
								<button
									type='button'
									onClick={handleParseAndPreview}
									disabled={(!hasPromptText && !files.ids.length) || files.blocked || isParsing}
									className={cn(
										'flex h-9 w-9 items-center justify-center rounded-xl bg-[#092E44] text-white transition-all',
										'hover:opacity-90 active:scale-95',
										'disabled:cursor-not-allowed disabled:opacity-30',
									)}
									aria-label='Generate pricing preview'>
									{isParsing ? (
										<Loader2 className='h-4 w-4 animate-spin' aria-hidden />
									) : (
										<ArrowRight className='h-4 w-4' strokeWidth={2} />
									)}
								</button>
							</div>
						</div>

						{/* Templates row */}
						<div className='mt-7'>
							<div className='mb-5 flex items-center gap-3'>
								<div className='h-px flex-1 bg-gray-200' />
								<span className='text-xs font-medium text-gray-500'>Templates</span>
								<div className='h-px flex-1 bg-gray-200' />
							</div>
							<div className='flex justify-center gap-2.5 flex-wrap'>
								{PRICING_TEMPLATES.map((t) => (
									<button
										type='button'
										key={t.label}
										onClick={() => handleTemplateClick(t)}
										className={cn(
											'flex shrink-0 items-center gap-3 rounded-xl border bg-white px-4 py-2.5 text-left text-sm shadow-sm',
											'transition-all hover:border-gray-400 hover:shadow active:scale-95',
											selectedTemplate?.label === t.label ? 'border-black text-gray-900 shadow-md' : 'border-gray-300 text-gray-700',
										)}>
										{t.iconSrc ? (
											<img
												src={t.iconSrc}
												alt={`${t.label} logo`}
												className={cn('h-4 w-4 object-contain', selectedTemplate?.label === t.label ? 'opacity-100' : 'opacity-70')}
											/>
										) : (
											<span className={cn('text-[15px] leading-none', selectedTemplate?.label === t.label ? 'opacity-100' : 'opacity-60')}>
												{t.icon}
											</span>
										)}
										<span
											className={cn('font-medium leading-none', selectedTemplate?.label === t.label ? 'text-gray-900' : 'text-gray-900')}>
											{t.label}
										</span>
									</button>
								))}
							</div>
						</div>

						{/* Skip */}
						<div className='mt-6 text-center'>
							<button type='button' onClick={handleSkip} className='text-sm text-gray-500 transition-colors hover:text-gray-900'>
								or get back to dashboard
							</button>
						</div>
					</div>
				)}

				{/* ── Phase: preview ───────────────────────────────────── */}
				{phase === 'preview' && schema && (
					<div className='relative z-10 flex w-full min-w-0 max-w-[1420px] flex-col'>
						{/* Header */}
						<div className='mb-8 shrink-0 text-center sm:mb-9'>
							<p className='text-[13px] font-semibold leading-relaxed text-gray-700'>
								{schema.features.length} feature{schema.features.length !== 1 ? 's' : ''} · {schema.plans.length} plan
								{schema.plans.length !== 1 ? 's' : ''}
								{(schema.credit_grants ?? []).length > 0 &&
									` · ${(schema.credit_grants ?? []).length} credit grant${(schema.credit_grants ?? []).length !== 1 ? 's' : ''}`}
							</p>
						</div>

						{/* Canvas: comfortable vertical padding + cap so 4+ cards can still scroll inside */}
						<div className='flex flex-col px-2 sm:px-6'>
							<div className='mx-auto w-full max-w-[1320px]'>
								{/* min-h keeps the frame visibly tall when plans are few; max-h + overflow when many. Inner py is unmistakable breathing room. */}
								<div className='relative min-h-[min(56vh,44rem)] max-h-[min(72vh,52rem)] w-full overflow-x-hidden overflow-y-auto rounded-2xl border border-gray-400 pricing-preview-canvas sm:max-h-[min(74vh,54rem)]'>
									<div className='px-6 py-20 sm:px-8 sm:py-24 md:px-10 md:py-32'>
										<div className='relative z-0 mx-auto w-full max-w-[1220px]'>
											<div
												className={cn(
													'grid gap-5 justify-items-stretch transition-opacity duration-500 sm:gap-6',
													showPreviewShimmer && !fadePreviewShimmer ? 'pointer-events-none opacity-0' : 'opacity-100',
													previewCards.length === 1
														? 'grid-cols-1 max-w-sm mx-auto'
														: previewCards.length === 2
															? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
															: previewCards.length === 3
																? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
																: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
												)}>
												{previewCards.map((card) => (
													<PricingCard key={card.id} {...card} className='w-full' isPreview />
												))}
											</div>
										</div>
									</div>

									{showPreviewShimmer && (
										<div
											className={cn('pricing-shimmer-overlay pointer-events-none z-10', fadePreviewShimmer && 'pricing-shimmer-fadeout')}
										/>
									)}
								</div>
							</div>

							<div className='mx-auto mt-9 flex w-full max-w-[1320px] shrink-0 items-center justify-end gap-6 sm:mt-10'>
								<button type='button' onClick={handleBack} className='text-sm text-gray-800 transition-colors hover:text-gray-900'>
									Back
								</button>
								<Button
									type='button'
									onClick={() => void handleConfirmCreate()}
									className='rounded-xl px-5 py-2.5 shadow-sm active:scale-95'>
									Create
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* ── Phase: creating ──────────────────────────────────── */}
				{phase === 'creating' && (
					<div className='w-full max-w-2xl'>
						<div className='rounded-2xl border border-gray-200 bg-white p-10 shadow-sm sm:p-11'>
							<h2 className='text-center text-xl font-semibold text-gray-900'>Building your pricing</h2>
							<p className='mt-2.5 text-center text-sm text-gray-500'>This usually takes a few seconds</p>

							<div className='mt-10 flex flex-col items-center'>
								<div
									className='flex w-full min-w-0 max-w-[36rem] items-center justify-center gap-0 px-2 sm:px-6'
									role='list'
									aria-label='Setup progress'>
									{setupProgressSteps.map((step, idx) => {
										const isCompleted = completedSteps.has(step);
										const isActive = activeStepIdx === idx;
										const prevCompleted = idx > 0 && completedSteps.has(setupProgressSteps[idx - 1]);

										return (
											<Fragment key={step}>
												{idx > 0 && (
													<div
														className={cn(
															'mx-2 h-0.5 min-w-[2rem] flex-1 rounded-full transition-colors duration-500 ease-out sm:mx-3 sm:min-w-[3.5rem]',
															prevCompleted ? 'bg-emerald-500' : 'bg-gray-200',
														)}
														aria-hidden
													/>
												)}
												<div
													role='listitem'
													className={cn(
														'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 sm:h-10 sm:w-10',
														isCompleted && 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25',
														!isCompleted &&
															isActive &&
															'bg-white text-emerald-600 ring-2 ring-emerald-400/60 ring-offset-2 ring-offset-white',
														!isCompleted && !isActive && 'border border-gray-200 bg-gray-50 text-gray-400',
													)}
													aria-current={isActive ? 'step' : undefined}>
													{isCompleted ? (
														<Check className='h-[18px] w-[18px] sm:h-5 sm:w-5' strokeWidth={2.5} aria-hidden />
													) : isActive ? (
														<span className='h-2 w-2 animate-pulse rounded-full bg-emerald-500' aria-hidden />
													) : (
														<span aria-hidden>{idx + 1}</span>
													)}
												</div>
											</Fragment>
										);
									})}
								</div>

								{creatingStatusLabel && (
									<div className='mt-8 flex min-h-[2.75rem] flex-col items-center text-center' role='status' aria-live='polite'>
										<p
											className={cn(
												'text-[15px] font-medium leading-relaxed transition-colors duration-300 sm:text-base',
												currentStep === 'done' ? 'text-gray-500' : 'text-gray-900',
											)}>
											{creatingStatusLabel}
										</p>
									</div>
								)}
							</div>

							{currentStep === 'done' && (
								<div className='mt-8 flex justify-center'>
									<div className='flex items-center gap-2 text-sm font-medium text-gray-600'>
										<Loader2 className='h-4 w-4 animate-spin' aria-hidden />
										Redirecting to your plans…
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default PricingSetupPage;
