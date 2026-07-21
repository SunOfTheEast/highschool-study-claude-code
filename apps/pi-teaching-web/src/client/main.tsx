import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return <main className="boot"><p>StudyForge</p><h1>你的学习工作区</h1></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
