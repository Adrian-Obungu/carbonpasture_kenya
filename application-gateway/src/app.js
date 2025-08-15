/* app.js 
 * CarbonPasture Gateway App
 * SPDX-License-Identifier: Apache-2.0
 */

const grpc          = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto        = require('node:crypto');
const fs            = require('node:fs/promises');
const path          = require('node:path');
const { TextDecoder } = require('node:util');

//
// -------------------------
// Helpers
// -------------------------
function envOrDefault(key, def) {
  return process.env[key] || def;
}

function displayInputParameters() {
  console.log(`channelName:       ${channelName}`);
  console.log(`chaincodeName:     ${chaincodeName}`);
  console.log(`mspId:             ${mspId}`);
  console.log(`cryptoPath:        ${cryptoPath}`);
  console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
  console.log(`certDirectoryPath: ${certDirectoryPath}`);
  console.log(`tlsCertPath:       ${tlsCertPath}`);
  console.log(`peerEndpoint:      ${peerEndpoint}`);
  console.log(`peerHostAlias:     ${peerHostAlias}`);
}

//
// -------------------------
// Config
// -------------------------
const channelName   = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'carboncc');
const mspId         = envOrDefault('MSP_ID', 'Org1MSP');

// Paths to crypto materials
const cryptoPath       = envOrDefault(
  'CRYPTO_PATH',
  path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com')
);
const keyDirectoryPath = envOrDefault(
  'KEY_DIRECTORY_PATH',
  path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore')
);
const certDirectoryPath = envOrDefault(
  'CERT_DIRECTORY_PATH',
  path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts')
);
const tlsCertPath      = envOrDefault(
  'TLS_CERT_PATH',
  path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')
);

const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();

//
// -------------------------
// Gateway Initialization
// -------------------------
async function initializeGateway() {
  console.log("DEBUG: Initializing Fabric Gateway...");

  return Promise.race([
    (async () => {
      const tlsRootCert = await fs.readFile(tlsCertPath);
      const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
      const client = new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
      });

      const [certFile] = await fs.readdir(certDirectoryPath);
      const credentials = await fs.readFile(path.join(certDirectoryPath, certFile));
      const identity = { mspId, credentials };

      const [keyFile] = await fs.readdir(keyDirectoryPath);
      const privateKeyPem = await fs.readFile(path.join(keyDirectoryPath, keyFile));
      const privateKey = crypto.createPrivateKey(privateKeyPem);
      const signer = signers.newPrivateKeySigner(privateKey);

      const gateway = connect({
        client,
        identity,
        signer,
        hash: hash.sha256,
        evaluateOptions:   () => ({ deadline: Date.now() + 5000 }),
        endorseOptions:    () => ({ deadline: Date.now() + 15000 }),
        submitOptions:     () => ({ deadline: Date.now() + 30000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 120000 }),
      });

      const network  = gateway.getNetwork(channelName);
      const contract = network.getContract(chaincodeName);

      console.log("DEBUG: Gateway initialized successfully.");
      return { gateway, client, contract };
    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('⏱️ Gateway connection timed out')), 5000))
  ]);
}

//
// -------------------------
// REST API Helpers
// -------------------------
async function connectGateway() {
  const { contract } = await initializeGateway();
  return contract;
}

async function createAsset(type, credits, farmerId, date) {
  console.log("DEBUG: Creating new asset...");
  const { gateway, client, contract } = await initializeGateway();
  try {
    const id = `carbonAsset${Date.now()}`;
    await contract.submitTransaction('CreateAsset', id, type, String(credits), farmerId, date);
    console.log("DEBUG: Asset created successfully:", id);
    return { ID: id, SequestrationType: type, CarbonCredits: credits, FarmerID: farmerId, IssuanceDate: date };
  } finally {
    console.log("DEBUG: Closing gateway after createAsset()");
    await gateway.close();
    client.close();
  }
}

async function getAllAssets() {
  console.log("DEBUG: Starting getAllAssets()");
  const { gateway, client, contract } = await initializeGateway();

  try {
    console.log("DEBUG: Calling evaluateTransaction for GetAllAssets...");
    const resultBytes = await Promise.race([
      contract.evaluateTransaction('GetAllAssets'),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for Fabric response")), 10000))
    ]);

    console.log("DEBUG: Transaction returned, decoding...");
    const raw = JSON.parse(utf8Decoder.decode(resultBytes));
    console.log("DEBUG: Decoded assets:", raw);

    return raw.map(a => ({
      ID: a.ID,
      SequestrationType: a.SequestrationType || a.Color,
      CarbonCredits:      a.CarbonCredits      || a.Size,
      FarmerID:           a.FarmerID           || a.Owner,
      IssuanceDate:       a.IssuanceDate       || a.AppraisedValue
    }));
  } finally {
    console.log("DEBUG: Closing gateway and client after getAllAssets()");
    await gateway.close();
    client.close();
  }
}

//
// -------------------------
// CLI Functions (unchanged)
// -------------------------
const assetId = `carbonAsset${Date.now()}`;

async function mainCLI() {
  displayInputParameters();

  const { gateway, client, contract } = await initializeGateway();
  try {
    await initLedger(contract);
    await getAllAssetsCLI(contract);
    await createAssetCLI(contract);
    await transferAssetAsyncCLI(contract);
    await readAssetByIDCLI(contract);
    await updateNonExistentAssetCLI(contract);
  } finally {
    gateway.close();
    client.close();
  }
}

async function initLedger(contract) {
  console.log('\n--> Submit Transaction: InitLedger');
  await contract.submitTransaction('InitLedger');
  console.log('*** Transaction committed successfully');
}

async function getAllAssetsCLI(contract) {
  console.log('\n--> Evaluate Transaction: GetAllAssets');
  const bytes = await contract.evaluateTransaction('GetAllAssets');
  const list = JSON.parse(utf8Decoder.decode(bytes));
  console.log('*** Result:', list);
}

async function createAssetCLI(contract) {
  console.log('\n--> Submit Transaction: CreateAsset');
  await contract.submitTransaction('CreateAsset', assetId, 'pasture-restoration', '100', 'farmer001', '2025-08-01');
  console.log('*** Transaction committed successfully');
}

async function transferAssetAsyncCLI(contract) {
  console.log('\n--> Async Submit Transaction: TransferAsset');
  const commit = await contract.submitAsync('TransferAsset', { arguments: [assetId, 'CarbonMarketplace'] });
  const oldOwner = utf8Decoder.decode(commit.getResult());
  console.log(`*** Ownership transferred from ${oldOwner} to CarbonMarketplace`);
  const status = await commit.getStatus();
  if (!status.successful) throw new Error(`Commit failed: ${status.code}`);
  console.log('*** Transaction committed successfully');
}

async function readAssetByIDCLI(contract) {
  console.log('\n--> Evaluate Transaction: ReadAsset');
  const bytes = await contract.evaluateTransaction('ReadAsset', assetId);
  console.log('*** Result:', JSON.parse(utf8Decoder.decode(bytes)));
}

async function updateNonExistentAssetCLI(contract) {
  console.log('\n--> Submit Transaction: UpdateAsset asset70');
  try {
    await contract.submitTransaction('UpdateAsset', 'asset70', 'tree-planting', '50', 'farmerX', '2025-08-01');
    console.log('******** FAILED to return an error');
  } catch (e) {
    console.log('*** Successfully caught the error:', e.message);
  }
}

// Run CLI if flagged
if (process.env.RUN_CLI === 'true') {
  mainCLI().catch(err => {
    console.error('******** FAILED to run the application:', err);
    process.exitCode = 1;
  });
}

//
// -------------------------
// Exports
// -------------------------
module.exports = {
  initializeGateway,
  connectGateway,
  createAsset,
  getAllAssets,
  main: async () => ({ createAsset, getAllAssets })
};
