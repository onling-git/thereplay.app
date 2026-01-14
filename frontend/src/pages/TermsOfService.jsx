// src/pages/TermsOfService.jsx
import React from 'react';
import Header from '../components/Header/Header';
import FooterNav from '../components/FooterNav/FooterNav';
import './css/legal.css';

const TermsOfService = () => {
  return (
    <div>
      <Header />
      <div className="legal-document">
        <div className="legal-container">
          <h1>Terms of Service</h1>
          <p className="last-updated">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using The Final Play website and services, you accept and agree to be 
              bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              The Final Play provides football live scores, statistics, news, and related content. 
              We offer both free and premium subscription services.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>
              To access certain features, you may need to create an account. You are responsible for:
            </p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information</li>
              <li>Updating your information as necessary</li>
            </ul>
          </section>

          <section>
            <h2>4. Premium Subscriptions</h2>
            <p>
              Premium subscriptions provide additional features and benefits:
            </p>
            <ul>
              <li>Ad-free browsing experience</li>
              <li>Option to control tracking preferences</li>
              <li>Premium statistics and content</li>
              <li>Priority customer support</li>
            </ul>
            
            <h3>Billing and Payment:</h3>
            <ul>
              <li>Subscriptions are billed in advance on a monthly or yearly basis</li>
              <li>Payments are processed securely through Stripe</li>
              <li>Prices may change with 30 days notice</li>
              <li>Refunds are handled according to our refund policy</li>
            </ul>
          </section>

          <section>
            <h2>5. Cookie Policy</h2>
            <p>
              We use cookies to enhance your experience. You can choose to:
            </p>
            <ul>
              <li>Accept all cookies (free service with ads)</li>
              <li>Customize your cookie preferences</li>
              <li>Subscribe for a cookie-free, ad-free experience</li>
            </ul>
          </section>

          <section>
            <h2>6. User Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the proper functioning of the service</li>
              <li>Share your account credentials with others</li>
              <li>Use automated systems to access the service without permission</li>
            </ul>
          </section>

          <section>
            <h2>7. Content and Intellectual Property</h2>
            <p>
              All content on The Final Play, including text, graphics, logos, and data, 
              is the property of The Final Play or its content suppliers and is protected 
              by copyright laws.
            </p>
          </section>

          <section>
            <h2>8. Data Accuracy</h2>
            <p>
              While we strive to provide accurate and up-to-date information, we cannot 
              guarantee the accuracy of all data. Use of our service is at your own risk.
            </p>
          </section>

          <section>
            <h2>9. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your account at any time for 
              violation of these terms. You may cancel your subscription at any time 
              through your account settings.
            </p>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>
              The Final Play shall not be liable for any indirect, incidental, special, 
              or consequential damages resulting from the use of our service.
            </p>
          </section>

          <section>
            <h2>11. Privacy</h2>
            <p>
              Your privacy is important to us. Please review our Privacy Policy, which 
              also governs your use of the service.
            </p>
          </section>

          <section>
            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users 
              of any significant changes via email or through our website.
            </p>
          </section>

          <section>
            <h2>13. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with the laws 
              of the United Kingdom.
            </p>
          </section>

          <section>
            <h2>14. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <ul>
              <li>Email: legal@thefinalplay.com</li>
              <li>Address: The Final Play, Football Data Services</li>
            </ul>
          </section>
        </div>
      </div>
      <FooterNav />
    </div>
  );
};

export default TermsOfService;