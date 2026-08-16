// src/pages/admin/AdminLayout.tsx

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAppDispatch } from "@/app/hooks";
import { fetchAdminDataThunk } from "@/features/admin/adminSlice";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const dispatch = useAppDispatch();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load all admin data from the backend on first mount
  useEffect(() => {
    dispatch(fetchAdminDataThunk());
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-bg font-tajawal text-slate-100 flex flex-row-reverse" dir="rtl">
      <AdminSidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="md:hidden mb-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white"
          >
            ☰ القائمة
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
