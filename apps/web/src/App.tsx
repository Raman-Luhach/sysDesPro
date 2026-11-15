import { Compass } from 'lucide-react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout, RequireAuth } from './components/layout';
import { Button, EmptyState } from './components/ui';
import { LoginPage, RegisterPage } from './pages/auth';
import { BookingsPage } from './pages/bookings';
import { DealPage } from './pages/deal';
import { HomePage } from './pages/home';
import { LabPage } from './pages/lab';
import { MerchantPage } from './pages/merchant';
import { NewSlotPage } from './pages/new-slot';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/deals/:id" element={<DealPage />} />
        <Route path="/bookings" element={<RequireAuth><BookingsPage /></RequireAuth>} />
        <Route path="/merchant" element={<RequireAuth roles={['MERCHANT']}><MerchantPage /></RequireAuth>} />
        <Route path="/merchant/new" element={<RequireAuth roles={['MERCHANT']}><NewSlotPage /></RequireAuth>} />
        <Route path="/lab" element={<RequireAuth roles={['ADMIN']}><LabPage /></RequireAuth>} />
        <Route
          path="*"
          element={
            <EmptyState
              icon={<Compass className="size-6" />}
              title="Page not found"
              body="This page doesn't exist."
              action={
                <Link to="/">
                  <Button>Back to live deals</Button>
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  );
}
