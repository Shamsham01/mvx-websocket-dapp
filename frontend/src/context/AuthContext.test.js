import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { clearNativeAuthSession, MVX_AUTH_BUSY_MESSAGE } from '../services/nativeAuthSession';

const ADDRESS = 'erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq5qu5k2';
const TOKEN = 'native-token-1';

jest.mock('@multiversx/sdk-dapp/out/react/account/useGetAccountInfo', () => ({
  useGetAccountInfo: () => ({ account: { address: global.__testWallet.address } }),
}), { virtual: true });

jest.mock('@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo', () => ({
  useGetLoginInfo: () => ({
    tokenLogin: { nativeAuthToken: global.__testWallet.token },
  }),
}), { virtual: true });

jest.mock('@multiversx/sdk-dapp/out/providers/helpers/accountProvider', () => ({
  getAccountProvider: () => ({
    logout: (...args) => global.__providerLogout(...args),
  }),
}), { virtual: true });

jest.mock('../services/api', () => ({
  authAPI: {
    getMe: (...args) => global.__authApi.getMe(...args),
    loginWithNativeAuth: (...args) => global.__authApi.loginWithNativeAuth(...args),
    logout: (...args) => global.__authApi.logout(...args),
    login: (...args) => global.__authApi.login(...args),
  },
}));

function textOf(testId) {
  return screen.getByTestId(testId).textContent;
}

function Probe() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="user">{auth.user?.address || ''}</div>
      <div data-testid="error">{auth.authError?.message || ''}</div>
      <div data-testid="busy">{auth.isAuthenticating ? 'yes' : 'no'}</div>
      <button type="button" onClick={() => navigate('/dashboard')}>Go dashboard</button>
      <button type="button" onClick={() => auth.retryNativeAuth()}>Retry Login</button>
      <button type="button" onClick={() => auth.logout()}>Disconnect / Reset Wallet Session</button>
    </div>
  );
}

function Tree() {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AuthProvider login lifecycle', () => {
  beforeEach(() => {
    clearNativeAuthSession();
    localStorage.clear();
    global.__testWallet = { address: ADDRESS, token: TOKEN };
    global.__providerLogout = jest.fn(async () => {
      global.__testWallet.address = '';
      global.__testWallet.token = '';
    });
    global.__authApi = {
      getMe: jest.fn().mockResolvedValue({ user: { id: 1, address: ADDRESS } }),
      loginWithNativeAuth: jest.fn().mockResolvedValue({
        token: 'app-jwt',
        user: { id: 1, address: ADDRESS },
      }),
      logout: jest.fn().mockResolvedValue({ success: true }),
      login: jest.fn(),
    };
  });

  it('sends one login request under StrictMode and navigation', async () => {
    render(
      <React.StrictMode>
        <Tree />
      </React.StrictMode>
    );
    await waitFor(() => expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(1));
    expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledWith(TOKEN);
    await waitFor(() => expect(textOf('user')).toBe(ADDRESS));
    fireEvent.click(screen.getByRole('button', { name: 'Go dashboard' }));
    await waitFor(() => expect(textOf('path')).toBe('/dashboard'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(1);
  });

  it('does not retry after HTTP 401', async () => {
    global.__authApi.loginWithNativeAuth.mockRejectedValue({
      status: 401,
      code: 'invalid_token',
      error: 'Invalid or expired access token.',
    });
    const view = render(
      <React.StrictMode>
        <Tree />
      </React.StrictMode>
    );
    await waitFor(() => expect(textOf('error')).not.toBe(''));
    expect(textOf('busy')).toBe('no');
    expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(1);
    view.rerender(
      <React.StrictMode>
        <Tree />
      </React.StrictMode>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go dashboard' }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(1);
    expect(textOf('busy')).toBe('no');
  });

  it('does not create extra login requests after upstream rate limiting', async () => {
    global.__authApi.loginWithNativeAuth.mockRejectedValue({
      status: 503,
      code: 'upstream_rate_limited',
      error: MVX_AUTH_BUSY_MESSAGE,
      retryAfter: '30',
    });
    const view = render(<Tree />);
    await waitFor(() => expect(textOf('error')).toBe(MVX_AUTH_BUSY_MESSAGE));
    for (let i = 0; i < 5; i += 1) view.rerender(<Tree />);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(1);
    expect(textOf('busy')).toBe('no');
  });

  it('gives a fresh login attempt after disconnect and reconnect', async () => {
    const view = render(<Tree />);
    await waitFor(() => expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect / Reset Wallet Session' }));
    await waitFor(() => expect(textOf('user')).toBe(''));
    expect(global.__providerLogout).toHaveBeenCalled();
    global.__testWallet.address = ADDRESS;
    global.__testWallet.token = TOKEN;
    view.rerender(<Tree />);
    await waitFor(() => expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(2));
  });

  it('restores a valid session without posting Native Auth again', async () => {
    localStorage.setItem('token', 'existing-jwt');
    render(<Tree />);
    await waitFor(() => expect(textOf('user')).toBe(ADDRESS));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(global.__authApi.getMe).toHaveBeenCalled();
    expect(global.__authApi.loginWithNativeAuth).not.toHaveBeenCalled();
  });

  it('explicit retry sends one new request and does not loop', async () => {
    global.__authApi.loginWithNativeAuth
      .mockRejectedValueOnce({ status: 401, code: 'invalid_token', error: 'nope' })
      .mockResolvedValue({ token: 'app-jwt-2', user: { id: 1, address: ADDRESS } });
    render(<Tree />);
    await waitFor(() => expect(textOf('error')).not.toBe(''));
    fireEvent.click(screen.getByRole('button', { name: 'Retry Login' }));
    await waitFor(() => expect(textOf('user')).toBe(ADDRESS));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(global.__authApi.loginWithNativeAuth).toHaveBeenCalledTimes(2);
  });
});
