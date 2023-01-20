import { Getter } from 'jotai'
import { atomWithObservable } from 'jotai/utils'
import { Observable, Subject, fromEventPattern } from 'rxjs'
import { NodeEventHandler } from 'rxjs/internal/observable/fromEvent'
import { UnsubscribePromise } from '@polkadot/api/types'
import { ApiPromise } from '@polkadot/api'
import { apiPromiseAtom } from '../parachain/atoms'

type Options<Data> = {
  initialValue: Data | (() => Data)
  unstable_timeout?: number
}

interface Params<TSourceData, TCombinedData> {
  createSubscriber: (api: ApiPromise, get: Getter, handler: NodeEventHandler) => UnsubscribePromise
  createCombinedObservable: (api: ApiPromise, get: Getter, sourceObservable: Observable<TSourceData>) => Observable<TCombinedData>
  options: Options<TCombinedData>
}

export const atomWithStreamSubscription = <TSourceData, TCombinedData>({
  createSubscriber,
  createCombinedObservable,
  options,
}: Params<TSourceData, TCombinedData>) => {
  const subject = new Subject<TCombinedData>()
  let combinedObservable: Observable<TCombinedData> | null = null

  return atomWithObservable<TCombinedData>(get => {
    const api = get(apiPromiseAtom)

    if (!combinedObservable) {
      let subscriber: UnsubscribePromise | null = null
      const sourceObservable = fromEventPattern<TSourceData>(
        handler => {
          subscriber = api.isReady.then(() => createSubscriber(api, get, handler))
        },
        () => {
          subscriber && subscriber.then(unsubscribe => unsubscribe())
        }
      )
      combinedObservable = createCombinedObservable(api, get, sourceObservable)
      combinedObservable.subscribe(result => {
        subject.next(result)
      })
    }
    return subject
  }, options)
}