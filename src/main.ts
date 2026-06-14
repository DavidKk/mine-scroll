import { mountApp } from './app/app.ts';
import './styles/main.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Root element #app not found');
}

mountApp(root);
