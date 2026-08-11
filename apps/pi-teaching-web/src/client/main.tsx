import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CompanionRoot } from './companion/CompanionRoot';
import { DesktopRoot } from './desktop/DesktopRoot';
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css';
import './theme-liubai.css';
import './styles.css';
import './styles/workspace-shell.css';
import './styles/course.css';
import './styles/handout.css';
import './styles/classroom.css';
import './styles/knowledge.css';
import './styles/m1b.css';
import './styles/responsive.css';
import './styles/desktop.css';
import './styles/companion.css';

const companion = new URLSearchParams(window.location.search).get('window') === 'companion';
document.documentElement.dataset.studyforgeWindow = companion ? 'companion' : 'main';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {companion ? <CompanionRoot /> : <DesktopRoot />}
  </StrictMode>,
);
