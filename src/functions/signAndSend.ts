import type { ApiTypes } from '@polkadot/api-base/types/base'
import type { SubmittableExtrinsic, SignerOptions } from '@polkadot/api-base/types/submittable'

const signAndSend = (target: SubmittableExtrinsic<ApiTypes>, address: string, signer: SignerOptions['signer']) => {
  return new Promise(async (resolve, reject) => {
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
            });
          }
        } else if (result.status.isInvalid) {
          // @ts-ignore
          unsub();
          reject('Invalid transaction');
        }
      }
    )
  })
}

export default signAndSend