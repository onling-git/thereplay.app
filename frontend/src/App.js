// src/App.js (simplified)
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import Home from './pages/Home'; // if you have a home page
import TeamOverview from './pages/TeamOverview';
import MatchLive from './pages/MatchLive';
import MatchReport from './pages/MatchReport'; // if you have it
import Account from './pages/Account'; // Account page
import SubscriptionPlansPage from './pages/SubscriptionPlansPage';
import SubscriptionManagementPage from './pages/SubscriptionManagementPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import SubscriptionCancelPage from './pages/SubscriptionCancelPage';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/subscription/plans" element={<SubscriptionPlansPage />} />
            <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
            <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
            <Route path="/account/subscription" element={<SubscriptionManagementPage />} />
            <Route path="/:teamSlug/match/:matchId/live" element={<MatchLive />} />
            <Route path="/:teamSlug/match/:matchId/report" element={<MatchReport />} />
            <Route path="/:teamSlug" element={<TeamOverview />} />
            <Route path="/account" element={<Account />} />
            <Route path="/account/*" element={<Account />} />
            <Route path='/' element={<Home />} />
          </Routes>
        </BrowserRouter>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
export default App;
