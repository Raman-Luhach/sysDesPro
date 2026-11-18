import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './context/auth';
import { RealtimeProvider } from './context/realtime';
import { ThemeProvider, useTheme } from './context/theme';
import { ApiError } from './lib/api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/* Calm toasts: surface fill, no border, floating shadow. Success/error read from the tinted icon. */
const toastClassNames = {
  toast: '!rounded-2xl !border-0 !bg-surface !text-fg !shadow-pop !font-sans !gap-3 !px-4 !py-3.5',
  title: '!text-sm !font-medium',
  description: '!text-[13px] !text-muted',
  closeButton: '!border-0 !bg-surface-2 !text-muted hover:!bg-surface-3 hover:!text-fg',
  actionButton: '!rounded-full !bg-fg !text-bg !font-medium',
  cancelButton: '!rounded-full !bg-surface-2 !text-fg',
  success: '[&_[data-icon]]:!text-success',
  error: '[&_[data-icon]]:!text-danger',
  warning: '[&_[data-icon]]:!text-warn',
  info: '[&_[data-icon]]:!text-accent',
};

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      closeButton
      offset={76}
      gap={10}
      toastOptions={{ classNames: toastClassNames, style: { background: 'var(--surface)', color: 'var(--fg)', border: 'none', boxShadow: 'var(--shadow)' } }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <RealtimeProvider>
                <App />
                <ThemedToaster />
              </RealtimeProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
