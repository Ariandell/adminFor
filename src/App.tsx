import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
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

const router = createBrowserRouter([{
  path: '/',
  element: <Layout />,
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'courses', element: <CoursesPage /> },
    { path: 'courses/:courseId', element: <CourseDetailsPage /> },
    { path: 'courses/:courseId/lessons/new', element: <LessonEditorPage /> },
    { path: 'courses/:courseId/lessons/:lessonId', element: <LessonEditorPage /> },
    { path: 'tags', element: <TagsPage /> },
    { path: 'cards', element: <CardsPage /> },
    { path: 'homework', element: <HomeworkPage /> },
    { path: 'achievements', element: <AchievementsPage /> },
    { path: 'cosmetics', element: <CosmeticsPage /> },
    { path: 'subscriptions', element: <SubscriptionsPage /> },
    { path: 'promo-codes', element: <PromoCodesPage /> },
    { path: 'sources', element: <SourcesPage /> },
  ],
}]);

export default function App() {
  return <ToastProvider><Suspense fallback={loading}><RouterProvider router={router} /></Suspense></ToastProvider>;
}
