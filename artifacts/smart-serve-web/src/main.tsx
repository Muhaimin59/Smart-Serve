import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, LangProvider, NotificationProvider, ToastProvider, ThemeProvider, useAuth } from "./lib/store";
import { SocketBootstrapper } from "./lib/socket";
import { Footer, Navbar, Protected } from "./components/shell";
import { Particles, Toasts } from "./components/ui";
import Landing from "./pages/Landing";
import { ForgotPassword, GoogleLogin, Login, ResetPassword, Signup, VerifyEmail } from "./pages/Auth";
import { CustomerDashboard, ProvidersPage, ProviderProfile, ServicesPage, BookingsList } from "./pages/Customer";
import BookWizard from "./pages/Book";
import BookingDetail from "./pages/BookingDetail";
import { ProviderDashboard, ProviderEarnings, ProviderProfilePage } from "./pages/Provider";
import { AdminDashboard, AdminPage, AdminSettings } from "./pages/Admin";
import { FavoritesPage, NotFoundPage, SafetyPage, SettingsPage } from "./pages/Misc";
import "./styles.css";

function Shell() {
  const { user, ready } = useAuth();
  return (
    <>
      <SocketBootstrapper />
      <Particles />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/google-login" element={<GoogleLogin />} />

            {/* customer */}
            <Route
              path="/app"
              element={
                <Protected roles={["customer"]}>
                  <CustomerDashboard />
                </Protected>
              }
            />
            <Route
              path="/services"
              element={
                <Protected roles={["customer", "provider", "student_provider"]}>
                  <ServicesPage />
                </Protected>
              }
            />
            <Route
              path="/providers"
              element={
                <Protected roles={["customer", "provider", "student_provider"]}>
                  <ProvidersPage />
                </Protected>
              }
            />
            <Route
              path="/providers/:id"
              element={
                <Protected roles={["customer", "provider", "student_provider"]}>
                  <ProviderProfile />
                </Protected>
              }
            />
            <Route
              path="/book"
              element={
                <Protected roles={["customer"]}>
                  <BookWizard />
                </Protected>
              }
            />
            <Route
              path="/bookings/:id"
              element={
                <Protected roles={["customer", "provider", "student_provider", "admin"]}>
                  <BookingDetail />
                </Protected>
              }
            />
            <Route
              path="/bookings"
              element={
                <Protected roles={["customer", "provider", "student_provider", "admin"]}>
                  <BookingsList />
                </Protected>
              }
            />
            <Route
              path="/favorites"
              element={
                <Protected roles={["customer"]}>
                  <FavoritesPage />
                </Protected>
              }
            />
            <Route
              path="/safety"
              element={
                <Protected roles={["customer", "provider", "student_provider"]}>
                  <SafetyPage />
                </Protected>
              }
            />

            {/* provider */}
            <Route
              path="/provider"
              element={
                <Protected roles={["provider", "student_provider"]}>
                  <ProviderDashboard />
                </Protected>
              }
            />
            <Route
              path="/provider/profile"
              element={
                <Protected roles={["provider", "student_provider"]}>
                  <ProviderProfilePage />
                </Protected>
              }
            />
            <Route
              path="/provider/earnings"
              element={
                <Protected roles={["provider", "student_provider"]}>
                  <ProviderEarnings />
                </Protected>
              }
            />

            {/* admin */}
            <Route
              path="/admin"
              element={
                <Protected roles={["admin"]}>
                  <AdminDashboard />
                </Protected>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <Protected roles={["admin"]}>
                  <AdminPage section="analytics" />
                </Protected>
              }
            />
            <Route
              path="/admin/manage/:section"
              element={
                <Protected roles={["admin"]}>
                  <AdminPage section="manage" />
                </Protected>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <Protected roles={["admin"]}>
                  <AdminSettings />
                </Protected>
              }
            />

            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        {user === null && <Footer />}
      </div>
      <Toasts />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LangProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <BrowserRouter>
                <Shell />
              </BrowserRouter>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </LangProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

// PWA service worker (cache static assets only, never API responses)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
