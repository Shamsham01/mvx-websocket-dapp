import { fireEvent, render, screen } from '@testing-library/react';
import AuthRecovery from './AuthRecovery';
import { MVX_AUTH_BUSY_MESSAGE } from '../../services/nativeAuthSession';

describe('AuthRecovery', () => {
  it('shows the upstream busy message and keeps retry behind Retry-After', () => {
    const onRetry = jest.fn();
    const onDisconnect = jest.fn();
    render(
      <AuthRecovery
        error={{
          message: MVX_AUTH_BUSY_MESSAGE,
          code: 'upstream_rate_limited',
          retryAt: Date.now() + 30000,
        }}
        onRetry={onRetry}
        onDisconnect={onDisconnect}
      />
    );
    expect(screen.getByText(/MultiversX authentication services are temporarily busy/)).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry Login' });
    expect(retry.disabled).toBe(true);
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect / Reset Wallet Session' }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('retries once when the user asks and the cooldown has elapsed', () => {
    const onRetry = jest.fn();
    render(
      <AuthRecovery
        error={{
          message: 'Wallet authentication was rejected. Disconnect and reconnect your wallet to generate a fresh login.',
          code: 'invalid_token',
          retryAt: null,
        }}
        onRetry={onRetry}
        onDisconnect={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry Login' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
