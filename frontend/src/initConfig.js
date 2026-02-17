/**
 * sdk-dapp 5.x initApp config - must be called before rendering
 * See: https://docs.multiversx.com/sdk-and-tools/sdk-dapp/
 */
import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';

const network = process.env.REACT_APP_MVX_ENV || 'mainnet';
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

export const initConfig = {
  storage: { getStorageCallback: () => window.localStorage },
  dAppConfig: {
    nativeAuth: true,
    environment: environmentMap[network] || EnvironmentsEnum.mainnet,
    network: {
      apiAddress: apiAddressMap[network] || apiAddressMap.mainnet,
      explorerAddress: explorerAddressMap[network] || explorerAddressMap.mainnet,
      chainId: chainIdMap[network] || chainIdMap.mainnet,
    },
    theme: 'mvx:dark-theme',
  },
};
