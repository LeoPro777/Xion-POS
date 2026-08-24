/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectionTester } from '@/components/pos/connection-tester';
import * as hooks from '@/hooks/queries/use-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/queries/use-system');

describe('ConnectionTester', () => {
  const queryClient = new QueryClient();

  it('renders status card when backend is online', () => {
    vi.spyOn(hooks, 'useSystemStatus').mockReturnValue({
      data: {
        status: 'online',
        database: 'connected',
        anchor_currency: 'USD',
        current_exchange_rate_bs: 36.5,
        lockdown_mode: false,
      },
      isLoading: false,
      isError: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ConnectionTester />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Estado del Motor Local/i)).toBeDefined();
    expect(screen.getByText(/36.50 Bs \/ USD/i)).toBeDefined();
    expect(screen.getByText(/CONNECTED/i)).toBeDefined();
  });
});
