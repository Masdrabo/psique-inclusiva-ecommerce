import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Lazy glob (retorna funções)
const pages = import.meta.glob('./Pages/**/*.jsx');

createInertiaApp({
  title: (title) => `${title} - ${appName}`,

  resolve: async (name) => {
    const path = `./Pages/${name}.jsx`;

    const importPage = pages[path];

    if (!importPage) {
      // Ajuda brutal: mostra exactamente qual é o "name" que o Laravel está a enviar
      console.error(`[Inertia] Página não encontrada: ${path}`);
      console.log('[Inertia] Páginas disponíveis:', Object.keys(pages));
      throw new Error(`Inertia page not found: ${path}`);
    }

    const module = await importPage();
    return module.default ?? module;
  },

  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },

  progress: {
    color: '#4B5563',
  },
});
