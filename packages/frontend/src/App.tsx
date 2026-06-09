import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/HomePage.js';
import { CategoryPage } from './pages/CategoryPage.js';
import { PluginDetailPage } from './pages/PluginDetailPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { AuthProvider } from './lib/auth.js';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/plugin/:slug" element={<PluginDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
