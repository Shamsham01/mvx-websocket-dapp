/**
 * sdk-dapp 5.x initApp config - must be called before rendering
 * See: https://docs.multiversx.com/sdk-and-tools/sdk-dapp/
 *
 * For WalletConnect (xPortal, drfi): get a free project ID at
 * https://cloud.walletconnect.com/ and set REACT_APP_WALLETCONNECT_V2_PROJECT_ID
 */
import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';

const network = process.env.REACT_APP_MVX_ENV || 'mainnet';
const walletConnectV2ProjectId = process.env.REACT_APP_WALLETCONNECT_V2_PROJECT_ID || '';

const apiAddressMap = {
  mainnet: 'https://api.multiversx.com',
  testnet: 'https://testnet-api.multiversx.com',
  devnet: 'https://devnet-api.multiversx.com',
};
const explorerAddressMap = {
  mainnet: 'https://explorer.multiversx.com',
  testnet: 'https://testnet-explorer.multiversx.com',
  devnet: 'https://devnet-explorer.multiversx.com',
};
const chainIdMap = { mainnet: '1', testnet: 'T', devnet: 'D' };
const environmentMap = {
  mainnet: EnvironmentsEnum.mainnet,
  testnet: EnvironmentsEnum.testnet,
  devnet: EnvironmentsEnum.devnet,
};

const dAppConfig = {
  nativeAuth: true,
  environment: environmentMap[network] || EnvironmentsEnum.mainnet,
  network: {
    apiAddress: apiAddressMap[network] || apiAddressMap.mainnet,
    explorerAddress: explorerAddressMap[network] || explorerAddressMap.mainnet,
    chainId: chainIdMap[network] || chainIdMap.mainnet,
  },
  theme: 'mvx:dark-theme',
};

// WalletConnect (xPortal, drfi) requires a project ID from https://cloud.walletconnect.com/
if (walletConnectV2ProjectId) {
  dAppConfig.providers = {
    walletConnect: {
      walletConnectV2ProjectId,
    },
  };
}

export const initConfig = {
  storage: { getStorageCallback: () => window.localStorage },
  dAppConfig,
};
