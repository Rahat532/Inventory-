import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Returns from './pages/Returns';
import Settings from './pages/Settings';
import { ThemeProvider } from './lib/theme';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Use HashRouter when running from file:// (Electron prod) to ensure routing works
  const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const RouterComponent: React.ComponentType<any> = isFile ? HashRouter : BrowserRouter;
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterComponent>
          <div className="h-screen bg-background">
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/returns" element={<Returns />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </div>
        </RouterComponent>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;