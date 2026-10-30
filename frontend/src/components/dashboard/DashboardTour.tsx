import { Joyride, type EventData, STATUS, EVENTS } from 'react-joyride'
import { useTour } from '@/contexts/TourContext'

const BRAND = '#FF6900'

const STEPS = [
  // ── 1. Welcome ────────────────────────────────────────────────────────────
  {
    target: '[data-tour="topbar-logo"]',
    title: 'Welcome to Chop 🍽️',
    content: 'Chop makes group payments effortless — split bills, pool funds, or collect for group orders with a single shareable link. Let\'s walk you through in 60 seconds.',
    placement: 'bottom' as const,
    disableBeacon: true,
  },
  // ── 2. Quick actions ──────────────────────────────────────────────────────
  {
    target: '[data-tour="quick-actions"]',
    title: 'Create a session',
    content: 'Pick the split type that fits your situation. Chop Food splits a restaurant bill per item, Chop Bill splits any expense by percentage, Chop In collects voluntary contributions.',
    placement: 'bottom' as const,
    disableBeacon: true,
  },
  // ── 3. Active sessions ────────────────────────────────────────────────────
  {
    target: '[data-tour="sessions-list"]',
    title: 'Your active sessions',
    content: 'All your open and completed sessions appear here. Once everyone has paid, you\'ll see a Finalize button to request your payout directly to your bank.',
    placement: 'top' as const,
    disableBeacon: true,
  },
  // ── 4. Notifications ─────────────────────────────────────────────────────
  {
    target: '[data-tour="topbar-notifications"]',
    title: 'Notifications',
    content: 'You\'ll get a notification every time a participant pays their share — so you always know where things stand without chasing anyone.',
    placement: 'bottom' as const,
    disableBeacon: true,
  },
  // ── 5. Wallet ─────────────────────────────────────────────────────────────
  {
    target: '[data-tour="topbar-wallet"]',
    title: 'Your wallet',
    content: 'The wallet shows all your payout history. When a Chop In session is closed, head here to withdraw your collected funds to any Nigerian bank account.',
    placement: 'bottom' as const,
    disableBeacon: true,
  },
  // ── 6. Profile / settings ────────────────────────────────────────────────
  {
    target: '[data-tour="topbar-profile"]',
    title: 'Your profile',
    content: 'Update your name, photo, referral code, and password from the Settings page. You can also replay this tour anytime from here.',
    placement: 'bottom-end' as const,
    disableBeacon: true,
  },
  // ── 7. Done ───────────────────────────────────────────────────────────────
  {
    target: '[data-tour="quick-actions"]',
    title: 'You\'re all set! 🎉',
    content: 'That\'s the full tour. Create your first session now — it takes less than a minute.',
    placement: 'bottom' as const,
    disableBeacon: true,
  },
]

export default function DashboardTour() {
  const { run, stepIndex, stopTour, setStepIndex } = useTour()

  function handleCallback(data: EventData) {
    const { status, type, index, action } = data

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === 'prev' ? -1 : 1))
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      stopTour()
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleCallback}
      options={{
        primaryColor: BRAND,
        overlayColor: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        showProgress: true,
        skipBeacon: true,
        // v3 hides Skip by default — returning users on a new device need it
        buttons: ['back', 'close', 'primary', 'skip'],
        // The ✕ ends the tour instead of advancing to the next step
        closeButtonAction: 'skip',
      }}
      styles={{
        tooltip: {
          borderRadius: 16,
          padding: '20px 24px 16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
          maxWidth: 320,
        },
        tooltipTitle: {
          fontSize: 15,
          fontWeight: 700,
          color: '#18181b',
          marginBottom: 6,
        },
        tooltipContent: {
          fontSize: 13,
          lineHeight: '1.65',
          color: '#4b5563',
          padding: '4px 0 0',
        },
        buttonPrimary: {
          backgroundColor: BRAND,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          padding: '8px 18px',
        },
        buttonBack: {
          color: '#9ca3af',
          fontSize: 13,
          marginRight: 8,
        },
        buttonSkip: {
          color: '#9ca3af',
          fontSize: 12,
        },
        buttonClose: {
          color: '#9ca3af',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next →',
        skip: 'Skip tour',
      }}
    />
  )
}
