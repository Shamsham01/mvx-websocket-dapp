import fs from 'fs';
import path from 'path';

jest.mock('@multiversx/sdk-dapp/out/providers/types/providerFactory.types', () => ({
  ProviderTypeEnum: {
    extension: 'extension',
    crossWindow: 'crossWindow',
    webview: 'webview',
    ledger: 'ledger',
    passkey: 'passkey',
    metamask: 'metamask',
  },
}), { virtual: true });

const mockUnlockPanel = {
  openUnlockPanel: jest.fn(),
};

jest.mock('@multiversx/sdk-dapp/out/managers/UnlockPanelManager', () => ({
  UnlockPanelManager: {
    init: jest.fn(() => mockUnlockPanel),
  },
}), { virtual: true });

const { UnlockPanelManager } = require('@multiversx/sdk-dapp/out/managers/UnlockPanelManager');
const { initWalletConnect, openWalletConnect } = require('./walletConnect');

describe('wallet connect ownership', () => {
  beforeEach(() => {
    mockUnlockPanel.openUnlockPanel.mockClear();
    UnlockPanelManager.init.mockReset();
    UnlockPanelManager.init.mockImplementation(() => mockUnlockPanel);
  });

  it('initializes UnlockPanelManager once', () => {
    const first = initWalletConnect();
    const second = initWalletConnect();
    openWalletConnect();
    expect(first).toBe(mockUnlockPanel);
    expect(second).toBe(mockUnlockPanel);
    expect(UnlockPanelManager.init).toHaveBeenCalledTimes(1);
    expect(mockUnlockPanel.openUnlockPanel).toHaveBeenCalledTimes(1);
  });

  it('does not keep a second login effect or unlock panel in the shell or login page', () => {
    const read = (relativePath) => fs.readFileSync(
      path.join(__dirname, relativePath),
      'utf8'
    );
    expect(read('../pages/LoginPage.js')).not.toContain('UnlockPanelManager');
    expect(read('../pages/LoginPage.js')).not.toContain('loginWithNativeAuth');
    expect(read('../components/layout/AppShell.js')).not.toContain('loginWithNativeAuth');
    expect(read('../components/layout/AppShell.js')).not.toContain('UnlockPanelManager');
    expect(read('../components/Navbar.js')).not.toContain('UnlockPanelManager');
    expect(read('../components/Navbar.js')).not.toContain('loginWithNativeAuth');
  });
});
