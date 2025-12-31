
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GlobalError } from './components/GlobalError';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// Fix: STRICT_MODE sometimes causes confusion with component lifecycle and type requirements in some React environments. 
// Wrapping App in GlobalError provides the required children.
root.render(
  <GlobalError>
    <App />
  </GlobalError>
);
