import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const CourseDetailsPage = lazy(() => import('./pages/CourseDetailsPage'));
const LessonEditorPage = lazy(() => import('./pages/LessonEditorPage'));
const TagsPage = lazy(() => import('./pages/TagsPage'));
const CardsPage = lazy(() => import('./pages/CardsPage'));
const HomeworkPage = lazy(() => import('./pages/HomeworkPage'));
const AchievementsPage = lazy(() => import('./pages/ResourcePages').then(m => ({ default: m.AchievementsPage })));
const CosmeticsPage = lazy(() => import('./pages/ResourcePages').then(m => ({ default: m.CosmeticsPage })));
const SubscriptionsPage = lazy(() => import('./pages/ResourcePages').then(m => ({ default: m.SubscriptionsPage })));
const PromoCodesPage = lazy(() => import('./pages/ResourcePages').then(m => ({ default: m.PromoCodesPage })));
const SourcesPage = lazy(() => import('./pages/ResourcePages').then(m => ({ default: m.SourcesPage })));

const loading = <div className="py-20 text-center text-sm text-ink-400">Завантаження…</div>;

export default function App() {
  return <ToastProvider><BrowserRouter><Suspense fallback={loading}><Routes><Route path="/" element={<Layout />}>
    <Route index element={<DashboardPage />} />
    <Route path="courses" element={<CoursesPage />} />
    <Route path="courses/:courseId" element={<CourseDetailsPage />} />
    <Route path="courses/:courseId/lessons/new" element={<LessonEditorPage />} />
    <Route path="courses/:courseId/lessons/:lessonId" element={<LessonEditorPage />} />
    <Route path="tags" element={<TagsPage />} />
    <Route path="cards" element={<CardsPage />} />
    <Route path="homework" element={<HomeworkPage />} />
    <Route path="achievements" element={<AchievementsPage />} />
    <Route path="cosmetics" element={<CosmeticsPage />} />
    <Route path="subscriptions" element={<SubscriptionsPage />} />
    <Route path="promo-codes" element={<PromoCodesPage />} />
    <Route path="sources" element={<SourcesPage />} />
  </Route></Routes></Suspense></BrowserRouter></ToastProvider>;
}
