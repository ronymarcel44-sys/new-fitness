// src/pages/admin/AdminLayout.tsx

import { useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAppDispatch } from "@/app/hooks";
import { fetchAdminDataThunk } from "@/features/admin/adminSlice";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const dispatch = useAppDispatch();

  // Load all admin data from the backend on first mount
  useEffect(() => {
    dispatch(fetchAdminDataThunk());
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-bg font-tajawal text-slate-100 flex flex-row-reverse" dir="rtl">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
