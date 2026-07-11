import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import CoursesPage from './pages/CoursesPage';
import CourseDetailsPage from './pages/CourseDetailsPage';
import LessonEditorPage from './pages/LessonEditorPage';
import TagsPage from './pages/TagsPage';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<CoursesPage />} />
            <Route path="courses/:courseId" element={<CourseDetailsPage />} />
            <Route path="courses/:courseId/lessons/new" element={<LessonEditorPage />} />
            <Route path="courses/:courseId/lessons/:lessonId" element={<LessonEditorPage />} />
            <Route path="tags" element={<TagsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
