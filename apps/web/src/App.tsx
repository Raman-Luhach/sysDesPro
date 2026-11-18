import { motion } from 'framer-motion';
import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout, RequireAuth } from './components/layout';
import { EASE } from './components/kit';
import { Button } from './components/ui';
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Error / 404</div>
      <motion.div
        aria-hidden
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="mt-4 select-none font-display font-light leading-[0.8] tracking-[-0.07em] tabular-nums"
        style={{ fontSize: 'clamp(8rem, 30vw, 20rem)' }}
      >
        404
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }} className="mt-8 font-display text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
        This slot was <span className="font-serif italic">never listed</span>.
      </motion.h1>
      <p className="mt-3 max-w-sm text-[15px] text-muted">The page you&rsquo;re after doesn&rsquo;t exist. The live deals do.</p>
      <Link to="/" tabIndex={-1} className="mt-8">
        <Button size="lg" arrow>
          Back to live deals
        </Button>
      </Link>
    </section>
  );
}
