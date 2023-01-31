import type { Getter } from 'jotai'
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

/**
 * - This atom supports subscribing to any polkadot's query subscriptions APIs.
 * - You can offer a `createSubscriber` function to create any subscriber.
 * - The data stream listened to by this subscriber will be the source of an observable.
 * - Then, you can do anything to process the data stream base on the observable via Rx.js.
 * - You can offer a `createCombinedObservable` function to do this.
 * - Finally, the data processed will be the atom's value.
 * @param params an object
 * @param params.createSubscriber a function to create subscriber
 * @param params.createCombinedObservable a function to process the data stream via Rx.js
 * @param params.options the second param for `atomWithObservable`
 * 
 * @example
 * ```ts
 * const nowAtom = atomWithStreamSubscription({
 *   // https://polkadot.js.org/docs/api/start/api.query.subs
 *   createSubscriber: (api, get, handler) => api.query.timestamp.now(handler)，
 *   // `map` is a Rx.js method
 *   createCombinedObservable: (api, get, sourceObservable) => sourceObservable.pipe(map(timestamp => `now is ${timestamp}` )),
 *   options: {
 *     initialValue: 0
 *   }
 * })
 * ```
 * 
 * @returns WritableAtom
 */
export const atomWithStreamSubscription = <TSourceData, TCombinedData>({
  createSubscriber,
  createCombinedObservable,
  options,
}: Params<TSourceData, TCombinedData>) => {
  // use a subject to change the atom's value
  const subject = new Subject<TCombinedData>()
  // remember data process observable
  let combinedObservable: Observable<TCombinedData> | null = null

  return atomWithObservable<TCombinedData>(get => {
    const api = get(apiPromiseAtom)

    if (!combinedObservable) {
      let subscriber: UnsubscribePromise | null = null
      // change polkadot events to Rx.js events.
      const sourceObservable = fromEventPattern<TSourceData>(
        handler => {
          subscriber = api.isReady.then(() => createSubscriber(api, get, handler))
        },
        () => {
          subscriber && subscriber.then(unsubscribe => unsubscribe())
        }
      )
      combinedObservable = createCombinedObservable(api, get, sourceObservable)
      // subscribe data change and modify atom's value
      combinedObservable.subscribe(result => {
        subject.next(result)
      })
    }
    return subject
  }, options)
}