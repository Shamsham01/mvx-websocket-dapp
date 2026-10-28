import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { authAPI } from '../services/api';
import {
  clearNativeAuthSession,
  normalizeAuthError,
  runNativeAuthLogin,
} from '../services/nativeAuthSession';

const AuthContext = createContext(null);

async function logoutWalletProvider() {
  try {
    const provider = getAccountProvider();
    if (provider && typeof provider.logout === 'function') {
      await provider.logout();
    }
  } catch (_) {
    // Wallet session may already be cleared.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);

  const { account } = useGetAccountInfo();
  const loginInfo = useGetLoginInfo();
  const address = account?.address || '';
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken || '';

  const sessionGen = useRef(0);
  const loggingOut = useRef(false);
  const suppressAutoAuth = useRef(false);
  const prevAddress = useRef('');
  const userRef = useRef(null);
  const nativeTokenRef = useRef('');
  const logoutRef = useRef(async () => {});

  userRef.current = user;
  nativeTokenRef.current = nativeAuthToken;

  const requestLogin = useCallback(
    (accessToken) => authAPI.loginWithNativeAuth(accessToken),
    []
  );

  const persistSession = useCallback((data, gen) => {
    if (gen !== sessionGen.current) return false;
    if (!data?.token || !data?.user) {
      throw Object.assign(new Error('Authentication response was incomplete'), {
        status: 500,
        code: 'internal_error',
      });
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setAuthError(null);
    return true;
  }, []);

  const logout = useCallback(async ({ fromWallet = false } = {}) => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    suppressAutoAuth.current = true;
    sessionGen.current += 1;
    const gen = sessionGen.current;
    clearNativeAuthSession();
    try {
      if (!fromWallet) {
        await logoutWalletProvider();
      }
      try {
        await authAPI.logout();
      } catch (_) {
        // Stateless JWT logout is best-effort.
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (sessionGen.current === gen) {
        setUser(null);
        setAuthError(null);
        setIsAuthenticating(false);
      }
    } finally {
      loggingOut.current = false;
    }
  }, []);

  logoutRef.current = logout;

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return undefined;
    }
    authAPI
      .getMe()
      .then((data) => {
        if (!active || !data?.user) return;
        setUser(data.user);
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prev = prevAddress.current;
    prevAddress.current = address;
    if (prev && !address) {
      clearNativeAuthSession();
      suppressAutoAuth.current = true;
      if (userRef.current) {
        logoutRef.current({ fromWallet: true });
      }
      return;
    }
    if (!prev && address) {
      suppressAutoAuth.current = false;
    }
  }, [address]);

  useEffect(() => {
    if (loading || user || !address || !nativeAuthToken || suppressAutoAuth.current) {
      return undefined;
    }
    const gen = sessionGen.current;
    let active = true;
    setIsAuthenticating(true);
    runNativeAuthLogin(nativeAuthToken, { force: false, request: requestLogin })
      .then((data) => {
        if (!active || sessionGen.current !== gen) return;
        persistSession(data, gen);
      })
      .catch((err) => {
        if (!active || sessionGen.current !== gen) return;
        setAuthError(normalizeAuthError(err));
      })
      .finally(() => {
        if (active && sessionGen.current === gen) setIsAuthenticating(false);
      });
    return () => {
      active = false;
    };
  }, [loading, user, address, nativeAuthToken, requestLogin, persistSession]);

  const loginWithNativeAuth = useCallback(async (accessToken) => {
    const gen = sessionGen.current;
    setIsAuthenticating(true);
    try {
      const data = await runNativeAuthLogin(accessToken, { force: true, request: requestLogin });
      persistSession(data, gen);
      return data;
    } catch (err) {
      if (sessionGen.current === gen) setAuthError(normalizeAuthError(err));
      throw err;
    } finally {
      if (sessionGen.current === gen) setIsAuthenticating(false);
    }
  }, [persistSession, requestLogin]);

  const retryNativeAuth = useCallback(async () => {
    const token = nativeTokenRef.current;
    if (!token) {
      setAuthError({
        message: 'Connect your wallet to retry login.',
        code: 'missing_token',
        retryAt: null,
        status: null,
      });
      return null;
    }
    try {
      return await loginWithNativeAuth(token);
    } catch (_) {
      return null;
    }
  }, [loginWithNativeAuth]);

  const login = useCallback(async (walletAddress, signature, message) => {
    const data = await authAPI.login(walletAddress, signature, message);
    persistSession(data, sessionGen.current);
    return data;
  }, [persistSession]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticating,
    authError,
    login,
    loginWithNativeAuth,
    retryNativeAuth,
    logout,
  }), [
    user,
    loading,
    isAuthenticating,
    authError,
    login,
    loginWithNativeAuth,
    retryNativeAuth,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
