import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ProvedorDeToasts } from './componentes/toast';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/paginas.css';
import './estilos/sistema.css';
import './estilos/painel.css';

import { temaInicial } from './layout/tema';

document.documentElement.dataset.theme = temaInicial();

const cliente = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProvedorDeToasts>
          <App />
        </ProvedorDeToasts>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
