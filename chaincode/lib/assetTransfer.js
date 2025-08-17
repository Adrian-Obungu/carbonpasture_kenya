/*
 * CarbonPasture Chaincode
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class CarbonPastureContract extends Contract {

    async InitLedger(ctx) {
        console.info('============= START : Initialize Ledger with Carbon Credits ===========');

        const carbonAssets = [
            {
                ID: 'carbonAsset1',
                SequestrationType: 'pasture-restoration',
                CarbonCredits: 120,
                FarmerID: 'kisumu_farmer01',
                IssuanceDate: '2025-08-01'
            },
            {
                ID: 'carbonAsset2',
                SequestrationType: 'livestock-methane-reduction',
                CarbonCredits: 90,
                FarmerID: 'eldoret_farmer22',
                IssuanceDate: '2025-08-02'
            },
            {
                ID: 'carbonAsset3',
                SequestrationType: 'agroforestry',
                CarbonCredits: 200,
                FarmerID: 'nyeri_farmer08',
                IssuanceDate: '2025-08-03'
            },
            {
                ID: 'carbonAsset4',
                SequestrationType: 'biochar-soil-enrichment',
                CarbonCredits: 75,
                FarmerID: 'narok_farmer15',
                IssuanceDate: '2025-08-04'
            },
        ];

        for (const asset of carbonAssets) {
            await ctx.stub.putState(asset.ID, Buffer.from(JSON.stringify(asset)));
            console.info(`Asset ${asset.ID} initialized`);
        }

        console.info('============= END : Initialize Ledger ===========');
    }

    // Create a new Carbon Credit Asset
    async CreateAsset(ctx, id, sequestrationType, carbonCredits, farmerID, issuanceDate) {
        const asset = {
            ID: id,
            SequestrationType: sequestrationType,
            CarbonCredits: parseInt(carbonCredits),
            FarmerID: farmerID,
            IssuanceDate: issuanceDate,
        };
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(asset)));
        return JSON.stringify(asset);
    }

    // Read an asset by ID
    async ReadAsset(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    // Update an existing asset
    async UpdateAsset(ctx, id, sequestrationType, carbonCredits, farmerID, issuanceDate) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`Cannot update: Asset ${id} does not exist`);
        }

        const updatedAsset = {
            ID: id,
            SequestrationType: sequestrationType,
            CarbonCredits: parseInt(carbonCredits),
            FarmerID: farmerID,
            IssuanceDate: issuanceDate,
        };

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(updatedAsset)));
        return JSON.stringify(updatedAsset);
    }

    // Delete an asset
    async DeleteAsset(ctx, id) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`Cannot delete: Asset ${id} does not exist`);
        }
        await ctx.stub.deleteState(id);
    }

    // Transfer carbon credits to another owner (marketplace or buyer)
    async TransferAsset(ctx, id, newOwnerID) {
        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);
        const oldOwner = asset.FarmerID;
        asset.FarmerID = newOwnerID;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(asset)));
        return oldOwner;
    }

    // Get all carbon assets
    async GetAllAssets(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();

        while (!result.done) {
            const strValue = result.value.value.toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    // Check if an asset exists
    async AssetExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }
}

module.exports = CarbonPastureContract;
