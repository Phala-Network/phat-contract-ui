import type { ApiTypes } from '@polkadot/api-base/types/base'
import type { SubmittableExtrinsic, SignerOptions } from '@polkadot/api-base/types/submittable'

function signAndSend<ApiType extends ApiTypes>(target: SubmittableExtrinsic<ApiType>, address: string, signer: SignerOptions['signer']) {
  return new Promise(async (resolve, reject) => {
    try {
      // Ready -> Broadcast -> InBlock -> Finalized
      const unsub = await target.signAndSend(
        address, { signer }, (result) => {
          if (result.status.isInBlock) {
            let error;
            for (const e of result.events) {
              const { event: { data, method, section } } = e;
              if (section === 'system' && method === 'ExtrinsicFailed') {
                error = data[0];
              }
            }
            // @ts-ignore
            unsub();
            if (error) {
              reject(error);
            } else {
              resolve({
                hash: result.status.asInBlock.toHuman(),
                // @ts-ignore
                events: result.toHuman().events,
                result,
              });
            }
          } else if (result.status.isInvalid) {
            // @ts-ignore
            unsub();
            reject('Invalid transaction');
          }
        }
      )
    } catch (err) {
      reject(err)
    }
  })
}

export default signAndSend