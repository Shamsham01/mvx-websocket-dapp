/**
 * Network config - used by components that need network info
 * Primary config is in initConfig.js for initApp
 */
import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';

export const networkConfig = {
  mainnet: {
    name: 'mainnet',
    apiAddress: 'https://api.multiversx.com',
    explorerAddress: 'https://explorer.multiversx.com',
    chainId: '1',
    environment: EnvironmentsEnum.mainnet,
  },
  testnet: {
    name: 'testnet',
    apiAddress: 'https://testnet-api.multiversx.com',
    explorerAddress: 'https://testnet-explorer.multiversx.com',
    chainId: 'T',
    environment: EnvironmentsEnum.testnet,
  },
  devnet: {
    name: 'devnet',
    apiAddress: 'https://devnet-api.multiversx.com',
    explorerAddress: 'https://devnet-explorer.multiversx.com',
    chainId: 'D',
    environment: EnvironmentsEnum.devnet,
  },
};

export const getNetworkConfig = () => {
  const network = process.env.REACT_APP_MVX_ENV || 'mainnet';
  return networkConfig[network] || networkConfig.mainnet;
};
