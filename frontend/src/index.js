import React from 'react';
import ReactDOM from 'react-dom/client';
import { initApp } from '@multiversx/sdk-dapp/out/methods/initApp/initApp';
import { initConfig } from './initConfig';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

initApp(initConfig).then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch((err) => {
  console.error('Failed to initialize MultiversX dApp:', err);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
