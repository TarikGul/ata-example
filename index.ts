import { promises as fs } from "fs";

import { AssetTransferApi, constructApiPromise, TxResult } from '@substrate/asset-transfer-api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

const GREEN = '\u001b[32m';
const PURPLE = '\u001b[35m';

// Polkadot Asset Hub
const ws_url = 'wss://polkadot-asset-hub-rpc.polkadot.io';
// Polkadot
const ss58Format = 0;
// Asset ID to send
const assetId = '111';
// Amount to send
const assetAmount = '1000000';
// Asset to pay fees with
const feeAssetId = '111';
// Conversion of feeAssetId to the Location for the SignedExtension
const paysWithFeeOrigin =
	`{"parents":0,"interior":{"X2":[{"palletInstance":50},{"generalIndex":${feeAssetId}}]}}`;
// ParaId for where to send the asset
const destId = '1000';
// Address to which to send the asset
const destAddr = '14kjCMayPMV8xzCtyVN1zM7EZp6HbuAkmiU8KyvWempvmYAh';

const createKeyPair = async () => {
    await cryptoWaitReady();

    const keyPhrase = await fs.readFile('keyphrase.txt', 'utf-8')
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
    const keyring = new Keyring({ type: 'sr25519', ss58Format });
	const keyPair = keyring.addFromUri(keyPhrase, { name: 'keyPair' });
    
    return keyPair;
}

const createSubmittable = async (assetApi: AssetTransferApi, sendersAddr: string): Promise<TxResult<'payload'>> => {
	let callInfo: TxResult<'payload'>;
	try {
		callInfo = await assetApi.createTransferTransaction(
			destId, 					// Destination chain ID (0 if you want to send to a relay chain)
			destAddr,  					// Destination Address
			[assetId], 					// Asset to transfer
			[assetAmount], 				// Amount of the asset to transfer
			{
				format: 'payload',		// Format type - payload is necessary for `paysWithFeeOrigin`
				xcmVersion: 3,			// Xcm Version
				paysWithFeeOrigin, 		// Mulitlocation of the asset to pay on chain
				sendersAddr,			// Address of the sender of this tx.
			},
		);

		console.log(`${PURPLE}The following call data that is returned:\n${GREEN}${JSON.stringify(callInfo, null, 4)}`);
	} catch (e) {
		console.error(e);
		throw Error(e as string);
	}

    return callInfo
}

const main = async () => {
	const { api, specName, safeXcmVersion } = await constructApiPromise(ws_url);
	const assetApi = new AssetTransferApi(api, specName, safeXcmVersion);
	const keyPair = await createKeyPair();
	const txInfo = await createSubmittable(assetApi, keyPair.address);
	const { signature } = txInfo.tx.sign(keyPair);
	const extrinsic = assetApi.api.registry.createType(
		'Extrinsic',
		{ method: txInfo.tx.method },
		{ version: 4 }
	);
	
	extrinsic.addSignature(keyPair.address, signature, txInfo.tx.toHex());
	const res = await assetApi.api.tx(extrinsic).send();
	console.log(res.toHex());
};

main()
	.catch((err) => console.error(err))
	.finally(() => process.exit());
