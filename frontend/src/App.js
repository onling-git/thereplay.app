// src/App.js (simplified)
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.js";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { AdSenseProvider } from "./contexts/AdSenseContext";
import { CookieConsentBanner, CookieSettingsButton } from "./components/CookieConsent";
import TeamOnboarding from "./components/TeamOnboarding/TeamOnboarding";
import { useTeamOnboarding } from "./hooks/useTeamOnboarding";
import { addNoIndexMetaTags, getTestingModeStyles } from "./utils/testingMode";
import MainLayout from "./components/MainLayout/MainLayout"
import Home from "./pages/Home"; // if you have a home page
import TeamOverview from "./pages/TeamOverview";
import MatchLive from "./pages/MatchLive";
import MatchReport from "./pages/MatchReport"; // if you have it
import LeagueFixtureOverview from "./pages/LeagueFixtureOverview";
import Fixtures from "./pages/Fixtures";
import News from "./pages/News";
import Account from "./pages/Account"; // Account page
import TeamPreferences from "./pages/TeamPreferences"; // Team preferences page
import FollowedFixtures from "./pages/FollowedFixtures"; // Followed fixtures page
import SubscriptionPlansPage from "./pages/SubscriptionPlansPage";
import SubscriptionManagementPage from "./pages/SubscriptionManagementPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import SubscriptionCancelPage from "./pages/SubscriptionCancelPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Admin from "./pages/Admin";
import protectFooterFromAdSense from "./utils/adSenseFooterProtection";

import "./App.css";

function AppContent() {
  // eslint-disable-next-line no-unused-vars
  const { showOnboarding, startOnboarding, completeOnboarding, skipOnboarding } = useTeamOnboarding();
  const [existingPreferences, setExistingPreferences] = useState(null);

  // Initialize AdSense footer protection
  useEffect(() => {
    protectFooterFromAdSense();
    // Add runtime no-index meta tags in testing mode
    addNoIndexMetaTags();
  }, []);

  // Fetch existing team preferences when onboarding opens
  useEffect(() => {
    const fetchExistingPreferences = async () => {
      if (showOnboarding) {
        try {
          console.log('🔍 App: Fetching existing team preferences...');
          const authModule = await import('./api/auth.js');
          const preferences = await authModule.getTeamPreferences();
          console.log('🔍 App: Fetched existing preferences:', preferences);
          setExistingPreferences(preferences.data || {});
        } catch (error) {
          console.error('❌ App: Error fetching existing preferences:', error);
          setExistingPreferences({});
        }
      } else {
        setExistingPreferences(null); // Reset when modal closes
      }
    };

    fetchExistingPreferences();
  }, [showOnboarding]);

  return (
    <>
      <div style={getTestingModeStyles()}>
        <BrowserRouter>
            {/* <Routes>
              <Route path="/subscription/plans" element={<SubscriptionPlansPage />} />
              <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
              <Route path="/subscription/cancel" element={<SubscriptionCancelPage />} />
              <Route path="/account/subscription" element={<SubscriptionManagementPage />} />
              <Route path="/league/:leagueId/fixtures" element={<LeagueFixtureOverview />} />
              <Route path="/news" element={<News />} />
              <Route path="/:teamSlug/match/:matchId/live" element={<MatchLive />} />
              <Route path="/:teamSlug/match/:matchId/report" element={<MatchReport />} />
              <Route path="/:teamSlug" element={<TeamOverview />} />
              <Route path="/account" element={<Account />} />
              <Route path="/account/*" element={<Account />} />
              <Route path='/' element={<Home />} />
            </Routes> */}
            <Routes>
              {/* Routes WITHOUT nav/footer */}
              <Route
                path="/subscription/plans"
                element={<SubscriptionPlansPage />}
              />
              <Route
                path="/subscription/success"
                element={<SubscriptionSuccessPage />}
              />
              <Route
                path="/subscription/cancel"
                element={<SubscriptionCancelPage />}
              />

              {/* Legal pages - standalone without main layout */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              
              {/* Admin page - standalone without main layout */}
              <Route path="/admin" element={<Admin />} />

              {/* Routes WITH nav/footer */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/account" element={<Account />} />
                <Route path="/account/team-preferences" element={<TeamPreferences />} />
                <Route path="/account/subscription" element={<SubscriptionManagementPage />} />
                <Route path="/followed-fixtures" element={<FollowedFixtures />} />
                <Route
                  path="/league/:leagueId/fixtures"
                  element={<LeagueFixtureOverview />}
                />
                <Route path="/fixtures" element={<Fixtures />} />
                <Route path="/news" element={<News />} />
                <Route
                  path="/:teamSlug/match/:matchId/live"
                  element={<MatchLive />}
                />
                <Route
                  path="/:teamSlug/match/:matchId/report"
                  element={<MatchReport />}
                />
                <Route path="/:teamSlug" element={<TeamOverview />} />
              </Route>
            </Routes>
            
            {/* Cookie Consent Banner - shows globally */}
            <CookieConsentBanner />
            
            {/* Cookie Settings Button - shows when consent has been given */}
            <CookieSettingsButton />
            
            {/* Team Onboarding - shows for new users */}
            <TeamOnboarding
              isOpen={showOnboarding}
              onComplete={completeOnboarding}
              onSkip={skipOnboarding}
              isNewUser={!existingPreferences?.team_preferences?.favourite_team && 
                        (!existingPreferences?.team_preferences?.followed_teams || existingPreferences.team_preferences.followed_teams.length === 0)}
              initialFavoriteId={existingPreferences?.team_preferences?.favourite_team}
              initialFollowedIds={existingPreferences?.team_preferences?.followed_teams || []}
            />
          </BrowserRouter>
        </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AdSenseProvider>
          <AppContent />
        </AdSenseProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
