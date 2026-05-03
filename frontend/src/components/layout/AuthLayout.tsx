import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">React Starter</h1>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
