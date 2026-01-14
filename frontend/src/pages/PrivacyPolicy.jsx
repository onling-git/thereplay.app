// src/pages/PrivacyPolicy.jsx
import React from 'react';
import Header from '../components/Header/Header';
import FooterNav from '../components/FooterNav/FooterNav';
import './css/legal.css';

const PrivacyPolicy = () => {
  return (
    <div>
      <Header />
      <div className="legal-document">
        <div className="legal-container">
          <h1>Privacy Policy</h1>
          <p className="last-updated">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2>1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, 
              subscribe to our services, or contact us for support.
            </p>
            <ul>
              <li>Personal information (name, email address, phone number)</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Usage data and preferences</li>
              <li>Device and browser information</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide and maintain our services</li>
              <li>Process payments and subscriptions</li>
              <li>Send you important updates and notifications</li>
              <li>Improve our website and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>3. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to enhance your experience on our website. 
              You can control your cookie preferences through our cookie consent banner.
            </p>
            
            <h3>Types of Cookies We Use:</h3>
            <ul>
              <li><strong>Necessary Cookies:</strong> Essential for the website to function properly</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site</li>
              <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements</li>
              <li><strong>Personalization Cookies:</strong> Remember your preferences and settings</li>
            </ul>
          </section>

          <section>
            <h2>4. Premium Subscription Benefits</h2>
            <p>
              Premium subscribers enjoy additional benefits including:
            </p>
            <ul>
              <li>Option to decline tracking cookies</li>
              <li>No advertisements</li>
              <li>Enhanced browsing experience</li>
              <li>Priority customer support</li>
            </ul>
          </section>

          <section>
            <h2>5. Data Sharing and Disclosure</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties, 
              except as described in this policy:
            </p>
            <ul>
              <li>Service providers (Stripe for payment processing)</li>
              <li>Legal requirements (if required by law)</li>
              <li>Business transfers (in case of merger or acquisition)</li>
            </ul>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>Under data protection laws, you have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data</li>
              <li>Export your data</li>
              <li>Object to processing</li>
              <li>Withdraw consent</li>
            </ul>
            <p>
              You can exercise these rights through your account settings or by contacting us 
              at privacy@thefinalplay.com.
            </p>
          </section>

          <section>
            <h2>7. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information against 
              unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2>8. Children's Privacy</h2>
            <p>
              Our service is not directed to children under 13. We do not knowingly collect 
              personal information from children under 13.
            </p>
          </section>

          <section>
            <h2>9. International Users</h2>
            <p>
              If you are accessing our service from outside the UK, please note that your information 
              may be transferred to and processed in the UK.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any 
              significant changes by posting the new policy on this page.
            </p>
          </section>

          <section>
            <h2>11. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy, please contact us:
            </p>
            <ul>
              <li>Email: privacy@thefinalplay.com</li>
              <li>Address: The Final Play, Football Data Services</li>
            </ul>
          </section>
        </div>
      </div>
      <FooterNav />
    </div>
  );
};

export default PrivacyPolicy;