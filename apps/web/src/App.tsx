import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ToastContext';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MembersPage } from './features/members/MembersPage';
import { AgendamentosPage } from './features/scheduling/AgendamentosPage';
import { SettingsPage } from './features/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AppShell() {
  return (
    <ToastProvider>
      <Layout>
        <Outlet />
      </Layout>
    </ToastProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/socios" element={<MembersPage />} />
            <Route path="/agendamentos" element={<AgendamentosPage />} />
            <Route path="/definicoes" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
