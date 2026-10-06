import { Navigate, Route, Routes } from "react-router-dom";
import { MobileShell } from "@/components/mobile/MobileShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SuperOnlyRoute } from "@/components/SuperOnlyRoute";
import { AdminLayout } from "@/layouts/AdminLayout";
import { AdminCalendarPage } from "@/pages/admin/AdminCalendarPage";
import { AdminCustomersPage } from "@/pages/admin/AdminCustomersPage";
import { AdminDepositsPage } from "@/pages/admin/AdminDepositsPage";
import { AdminFloorPage } from "@/pages/admin/AdminFloorPage";
import { AdminKitchenPrepPage } from "@/pages/admin/AdminKitchenPrepPage";
import { AdminPromotionPage } from "@/pages/admin/AdminPromotionPage";
import { AdminReservationsPage } from "@/pages/admin/AdminReservationsPage";
import { AdminSettingsPage } from "@/pages/admin/AdminSettingsPage";
import { AdminSmsPage } from "@/pages/admin/AdminSmsPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { AdminTablesPage } from "@/pages/admin/AdminTablesPage";
import { AdminTodoPage } from "@/pages/admin/AdminTodoPage";
import { AdminHelpPage } from "@/pages/admin/AdminHelpPage";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/mobile/HomePage";
import { MePage } from "@/pages/mobile/MePage";
import { ReservePage } from "@/pages/mobile/ReservePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<MobileShell />}>
        <Route index element={<HomePage />} />
        <Route path="reserve" element={<ReservePage />} />
        <Route path="me" element={<MePage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminFloorPage />} />
        <Route path="tables" element={<AdminTablesPage />} />
        <Route path="todo" element={<AdminTodoPage />} />
        <Route path="help" element={<AdminHelpPage />} />
        <Route path="reservations" element={<AdminReservationsPage />} />
        <Route path="deposits" element={<AdminDepositsPage />} />
        <Route path="diners" element={<AdminCustomersPage />} />
        <Route path="promotion" element={<AdminPromotionPage />} />
        <Route path="calendar" element={<AdminCalendarPage />} />
        <Route path="kitchen-prep" element={<AdminKitchenPrepPage />} />
        <Route
          path="settings"
          element={
            <SuperOnlyRoute>
              <AdminSettingsPage />
            </SuperOnlyRoute>
          }
        />
        <Route
          path="users"
          element={
            <SuperOnlyRoute>
              <AdminUsersPage />
            </SuperOnlyRoute>
          }
        />
        <Route
          path="sms"
          element={
            <SuperOnlyRoute>
              <AdminSmsPage />
            </SuperOnlyRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
