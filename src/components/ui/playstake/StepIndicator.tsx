/**
 * StepIndicator — numbered step circles with dotted connectors showing progression.
 * Horizontal on desktop, vertical on mobile (when orientation="auto").
 *
 * @example
 * ```tsx
 * // All steps shown (landing page)
 * <StepIndicator
 *   steps={[
 *     { label: 'Choose a Game' },
 *     { label: 'Set Your Stake' },
 *     { label: 'Play the Match' },
 *     { label: 'Verified Result' },
 *     { label: 'Instant Settlement' },
 *   ]}
 * />
 *
 * // In-match progress (step 3 active, 1-2 completed)
 * <StepIndicator
 *   steps={[
 *     { label: 'Choose' },
 *     { label: 'Stake' },
 *     { label: 'Play' },
 *     { label: 'Verify' },
 *     { label: 'Settle' },
 *   ]}
 *   currentStep={3}
 * />
 * ```
 */

'use client';

import { Check } from 'lucide-react';

interface StepDef {
  /** Step label text. */
  label: string;
}

interface StepIndicatorProps {
  /** Step definitions. */
  steps: StepDef[];
  /** Currently active step (1-based). 0 = all shown, no active highlight. */
  currentStep?: number;
  /** Layout direction. "auto" = horizontal on md+, vertical below. */
  orientation?: 'horizontal' | 'vertical' | 'auto';
  /** Additional Tailwind classes. */
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep = 0,
  orientation = 'auto',
  className = '',
}: StepIndicatorProps) {
  const orientationClasses =
    orientation === 'horizontal'
      ? 'flex-row items-start'
      : orientation === 'vertical'
        ? 'flex-col items-start'
        : 'flex-col items-start md:flex-row md:items-start';

  return (
    <div className={`flex ${orientationClasses} ${className}`} role="list">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = currentStep > 0 && stepNum < currentStep;
        const isActive = currentStep > 0 && stepNum === currentStep;
        const isUpcoming = currentStep > 0 && stepNum > currentStep;
        const isShowAll = currentStep === 0;

        return (
          <div key={index} className="flex items-center" role="listitem">
            <div
              className={[
                'flex items-center',
                orientation === 'horizontal'
                  ? 'flex-col'
                  : orientation === 'vertical'
                    ? 'flex-row gap-3'
                    : 'flex-row gap-3 md:flex-col md:gap-0',
              ].join(' ')}
            >
              {/* Step circle */}
              <div
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold',
                  isCompleted || isActive || isShowAll
                    ? 'bg-ps-lime text-ps-text'
                    : 'border border-[var(--ps-border-light)] bg-ps-paper text-ps-muted dark:border-[var(--ps-border-dark)] dark:bg-ps-ink-2 dark:text-ps-muted-on-dark',
                  isActive ? 'shadow-ps-glow-lime' : '',
                ].join(' ')}
              >
                {isCompleted ? <Check size={18} strokeWidth={2.5} /> : stepNum}
              </div>

              {/* Step label */}
              <span
                className={[
                  'text-sm font-medium',
                  orientation === 'horizontal'
                    ? 'mt-2 text-center'
                    : orientation === 'vertical'
                      ? ''
                      : 'md:mt-2 md:text-center',
                  isUpcoming
                    ? 'text-ps-muted dark:text-ps-muted-on-dark'
                    : 'text-ps-text dark:text-ps-text-on-dark',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {index < steps.length - 1 && (
              <div
                className={[
                  orientation === 'horizontal'
                    ? 'mx-2 mt-5 h-0.5 w-8 shrink-0 lg:w-12'
                    : orientation === 'vertical'
                      ? 'ml-5 my-1 h-6 w-0.5 shrink-0'
                      : 'ml-5 my-1 h-6 w-0.5 shrink-0 md:ml-0 md:mx-2 md:mt-5 md:h-0.5 md:w-8 lg:md:w-12',
                  isCompleted || (isShowAll && index < steps.length - 1)
                    ? 'bg-ps-lime'
                    : '',
                ].join(' ')}
                style={
                  !(isCompleted || isShowAll)
                    ? {
                        backgroundImage:
                          orientation === 'vertical' || orientation === 'auto'
                            ? 'repeating-linear-gradient(180deg, var(--ps-lime-35) 0, var(--ps-lime-35) 4px, transparent 4px, transparent 8px)'
                            : 'repeating-linear-gradient(90deg, var(--ps-lime-35) 0, var(--ps-lime-35) 4px, transparent 4px, transparent 8px)',
                      }
                    : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
