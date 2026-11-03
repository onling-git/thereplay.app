import React from 'react';
import { Link } from 'react-router-dom';
import './LegalLinks.css';

export default function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Policies">
      <Link to="/privacy-policy">Privacy Policy</Link>
      <Link to="/cookie-policy">Cookie Policy</Link>
      <Link to="/terms-of-service">Terms of Service</Link>
      <Link to="/attribution-copyright-policy">Attribution &amp; Copyright</Link>
      <a href="mailto:contact@thereplay.app">Contact</a>
    </nav>
  );
}
