import React from 'react';
import Header from '../Header/Header';
import FooterNav from '../FooterNav/FooterNav';
import '../../pages/css/legal.css';

export default function LegalDocument({ title, children }) {
  return (
    <div>
      <Header />
      <main className="legal-document">
        <div className="legal-container">
          <h1>{title}</h1>
          <p className="last-updated">Last updated: 30 October 2026</p>
          {children}
          <section>
            <h2>Contact</h2>
            <p>For questions about this policy, contact The Replay at <a href="mailto:contact@thereplay.app">contact@thereplay.app</a>.</p>
          </section>
        </div>
      </main>
      <FooterNav />
    </div>
  );
}
