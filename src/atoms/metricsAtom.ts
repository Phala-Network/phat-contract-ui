import { atom } from 'jotai'


interface Metrics {
  contract: number
  stake: string
  staker: number
  idleWorker: number
  worker: number
}

const metricsStoreAtom = atom<Metrics>({
  contract: 0,
  stake: '0',
  staker: 0,
  idleWorker: 0,
  worker: 0,
})

const metricsProgressAtom = atom<{
  hasInited: boolean
  isLoading: boolean
}>({
  hasInited: false,
  isLoading: false,
})

export type MetricActions = { type: 'update' }

const formatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

function formatMetricValue(value: number | string | undefined | null) {
  if (value === null || value === undefined) {
    return null
  }
  return formatter.format(typeof value === 'string' ? BigInt(value.replace(/\..+/, '')) : value
  )
}

export const metricsAtom = atom(
  get => {
    const data = get(metricsStoreAtom)
    const state = get(metricsProgressAtom)
    return {
      ...state,
      data: {
        contract: formatMetricValue(data.contract),
        stake: formatMetricValue(data.stake),
        staker: formatMetricValue(data.staker),
        idleWorker: formatMetricValue(data.idleWorker),
        worker: formatMetricValue(data.worker),
      }
    }
  },
  async (_get, set, action: MetricActions) => {
    if (action.type === 'update') {
      set(metricsProgressAtom, p => ({ ...p, isLoading: true }))
      try {
        const response = await fetch(
          'https://squid.subsquid.io/phat-contract-squid/graphql',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query {
                    metaById(id: "0") {
                    contract
                    stake
                    staker
                    idleWorker
                    worker
                  }
                }
              `,
            }),
          }
        )
        if (!response.ok || response.status !== 200) {
          throw new Error(`Response failed: ${response.status}`)
        }
        const data = await response.json()
        const metrics = data.data.metaById
        set(metricsStoreAtom, metrics)
        set(metricsProgressAtom, {
          hasInited: true,
          isLoading: false,
        })
      } catch (error) {
        set(metricsProgressAtom, p => ({ ...p, isLoading: false }))
      }
    }
  }
)

metricsAtom.onMount = (set) => {
  set({ type: 'update' })
}
