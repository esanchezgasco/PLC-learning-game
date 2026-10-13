import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { getSettings, requestPersistence } from './db/db';
import { useApplyTheme, useSettings } from './hooks/useSettings';
import { seedDemo } from './services/demo';
import Dashboard from './pages/Dashboard';
import Subjects from './pages/Subjects';
import SubjectDetail from './pages/SubjectDetail';
import StructureEditor from './pages/StructureEditor';
import TopicPage from './pages/TopicPage';
import SectionStudy from './pages/SectionStudy';
import ExamPage from './pages/ExamPage';
import AttemptResults from './pages/AttemptResults';
import ReviewPage from './pages/ReviewPage';
import ProgressPage from './pages/ProgressPage';
import QuestionBank from './pages/QuestionBank';
import SettingsPage from './pages/SettingsPage';
import NotFound from './pages/NotFound';

let seeding = false;

export default function App() {
  const settings = useSettings();
  useApplyTheme(settings.theme);

  useEffect(() => {
    requestPersistence();
    // Crea l'assignatura de demostració la primera vegada
    (async () => {
      const s = await getSettings();
      if (!s.demoSeeded && !seeding) {
        seeding = true;
        await seedDemo();
      }
    })();
  }, []);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/assignatures" element={<Subjects />} />
            <Route path="/assignatures/:subjectId" element={<SubjectDetail />} />
            <Route path="/documents/:docId/estructura" element={<StructureEditor />} />
            <Route path="/temes/:topicId" element={<TopicPage />} />
            <Route path="/temes/:topicId/apartats/:sectionId" element={<SectionStudy />} />
            <Route path="/temes/:topicId/examen" element={<ExamPage />} />
            <Route path="/temes/:topicId/preguntes" element={<QuestionBank />} />
            <Route path="/intents/:attemptId" element={<AttemptResults />} />
            <Route path="/repas" element={<ReviewPage />} />
            <Route path="/progres" element={<ProgressPage />} />
            <Route path="/configuracio" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </ConfirmProvider>
    </ToastProvider>
  );
}
