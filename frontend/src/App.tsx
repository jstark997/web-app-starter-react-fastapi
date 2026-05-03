import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  );
}
