import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme-liubai.css';
import './styles.css';
import './styles/workspace-shell.css';
import './styles/course.css';
import './styles/handout.css';
import './styles/classroom.css';
import './styles/knowledge.css';
import './styles/responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
