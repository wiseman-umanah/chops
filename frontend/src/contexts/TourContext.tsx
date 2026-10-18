import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface TourContextValue {
  run: boolean
  stepIndex: number
  startTour: () => void
  stopTour: () => void
  setStepIndex: (i: number) => void
}

const TourContext = createContext<TourContextValue>({
  run: false,
  stepIndex: 0,
  startTour: () => {},
  stopTour: () => {},
  setStepIndex: () => {},
})

const STORAGE_KEY = 'chops_tour_done'

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Auto-start once for new users
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Small delay so the page is fully painted before the tour starts
      const t = setTimeout(() => setRun(true), 900)
      return () => clearTimeout(t)
    }
  }, [])

  const startTour = useCallback(() => {
    setStepIndex(0)
    setRun(true)
  }, [])

  const stopTour = useCallback(() => {
    setRun(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }, [])

  return (
    <TourContext.Provider value={{ run, stepIndex, startTour, stopTour, setStepIndex }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  return useContext(TourContext)
}
