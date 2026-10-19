import { CssBaseline, StyledEngineProvider, ThemeProvider } from '@mui/material';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { NotificationProvider } from '../global/components/NotificationProvider/NotificationProvider';
import { theme } from '../theme/theme';
import { queryClient as defaultQueryClient } from './queryClient';

interface AppProvidersProps {
  children: ReactNode;
  /** Tests pass their own client so cached data does not leak between tests. */
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient = defaultQueryClient }: AppProvidersProps) {
  return (
    // enableCssLayer puts MUI styles in the `mui` CSS layer, so our SASS modules
    // (which are not in a layer) always win without specificity hacks.
    <StyledEngineProvider enableCssLayer>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>{children}</NotificationProvider>
          {/* Only included in development builds */}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
