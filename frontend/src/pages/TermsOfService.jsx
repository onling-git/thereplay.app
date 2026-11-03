import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument from '../components/LegalDocument/LegalDocument';

export default function TermsOfService() {
  return (
    <LegalDocument title="Terms of Service">
      <section>
        <h2>Using The Replay</h2>
        <p>These terms apply to your use of thereplay.app, operated as The Replay. We provide football fixtures, scores, statistics, news links, community features and automated match reports. Some features require an account or paid subscription. If you do not agree to these terms, do not use the service.</p>
      </section>
      <section>
        <h2>Accounts and acceptable use</h2>
        <p>Provide accurate account information, keep your login credentials secure and tell us if you suspect unauthorised access. Do not impersonate others, bypass access controls, disrupt the service, misuse personal information or use the service unlawfully.</p>
        <p>Community contributions must not be abusive, discriminatory, defamatory, misleading or infringe another person's rights. You remain responsible for your contributions and grant us the permission needed to store, display and moderate them to operate the service. We may remove content or restrict access where reasonably necessary for safety, security or breaches of these terms.</p>
      </section>
      <section>
        <h2>AI-generated content and accuracy</h2>
        <p><strong>Reports are auto-generated and may contain errors.</strong> Match reports use AI alongside third-party match data and selected reporter context. They are not guaranteed to have been reviewed by a human before publication.</p>
        <p>Scores, timings, statistics, player identities, descriptions and interpretations may be inaccurate, incomplete or delayed. Check important information against official club, competition or other reliable sources. Content is for general information and entertainment, not betting, financial or professional advice.</p>
        <p>Send suspected errors to <a href="mailto:contact@thereplay.app">contact@thereplay.app</a> with the page URL and supporting details so we can investigate and, where appropriate, correct or remove content.</p>
      </section>
      <section>
        <h2>Subscriptions, renewals and cancellation</h2>
        <p>The price, billing interval, included features and any trial terms shown at checkout apply to your purchase. Payments are processed through Stripe. Unless the checkout states otherwise, recurring subscriptions renew until cancelled. You can manage or cancel through the subscription-management area.</p>
        <p>Cancellation normally stops the next renewal; access continues until the end of the paid period shown in your account, unless stated otherwise at purchase. Contact us about billing errors, refunds or cancellation problems. Nothing in these terms limits statutory cancellation, refund or other consumer rights. We will give notice of material price or subscription changes where required.</p>
        <p>A paid plan does not automatically give consent to optional cookies, and ad-free access does not mean the site uses no essential storage. See our <Link to="/cookie-policy">Cookie Policy</Link>.</p>
        <p>Access to football content requires either consent to the optional analytics, marketing and personalization categories or an active subscription. Policies and account/subscription access remain available without optional consent. You may withdraw consent through Cookie Settings; without an active subscription, this pauses football access until you choose again or subscribe.</p>
      </section>
      <section>
        <h2>Copyright, attribution and external services</h2>
        <p>Rights in club badges, competition marks, photographs, posts, publisher material and third-party data remain with their respective owners. The Replay is independent and is not endorsed by those organisations unless explicitly stated.</p>
        <p>Use of the site does not grant a general licence to republish, commercially redistribute or extract protected content or databases. Statutory exceptions and any explicit licences still apply. Read our <Link to="/attribution-copyright-policy">Attribution &amp; Copyright Policy</Link> for source information and rights complaints.</p>
        <p>Links and social posts may lead to services outside our control. Their own terms and privacy policies apply; a link does not imply endorsement.</p>
      </section>
      <section>
        <h2>Availability and liability</h2>
        <p>Features and data feeds may be interrupted or change. We do not guarantee uninterrupted access or that all third-party content will remain available. We will handle paid-service issues in accordance with applicable consumer law.</p>
        <p>Nothing excludes liability that cannot lawfully be excluded, including liability for fraud or death or personal injury caused by negligence. Your mandatory consumer rights remain unaffected. Subject to those protections, we are not responsible for losses that were not reasonably foreseeable or business losses arising from personal use of the service.</p>
      </section>
      <section>
        <h2>Privacy, changes and disputes</h2>
        <p>Our <Link to="/privacy-policy">Privacy Policy</Link> explains personal-data processing. We may update these terms and will give notice of material changes where required. Updates do not remove rights relating to earlier purchases.</p>
        <p>Please contact us first about a dispute so we can try to resolve it. Nothing here removes any mandatory protections or rights to bring proceedings available under the law applicable to you.</p>
      </section>
    </LegalDocument>
  );
}
