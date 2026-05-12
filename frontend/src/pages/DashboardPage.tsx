// Placeholder for the consuming application — replace this page with your real dashboard.
import { useAuth } from '@/context/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const greetingName = user?.displayName ?? user?.firstName ?? user?.email ?? '';

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        Welcome{greetingName ? `, ${greetingName}` : ''}
      </h1>
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-gray-600 shadow-sm">
        <p className="mb-2 font-medium text-gray-900">Dashboard placeholder</p>
        <p>
          This is a placeholder page provided by <span className="font-mono">react-starter</span>.
          Replace <span className="font-mono">src/pages/DashboardPage.tsx</span> with your
          application&apos;s home screen.
        </p>
      </div>
    </div>
  );
}
