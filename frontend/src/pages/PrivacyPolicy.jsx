import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument from '../components/LegalDocument/LegalDocument';

export default function PrivacyPolicy() {
  return (
    <LegalDocument title="Privacy Policy">
      <section>
        <h2>Who we are</h2>
        <p>The Replay operates thereplay.app and is responsible for the personal information we process to run this service. This policy covers visitors, account holders and people whose public posts are collected for football coverage.</p>
      </section>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account details such as your name, email address, securely hashed password, login history and any optional profile details you provide.</li>
          <li>Your favourite and followed teams, followed matches, community contributions, subscription status and messages you send us.</li>
          <li>Stripe customer and subscription identifiers and payment-status information. Stripe processes payment details; we do not store your full payment-card number.</li>
          <li>Technical information, including IP addresses, browser/device information and service logs, and cookie-consent choices. Where enabled with consent, analytics and advertising services also collect usage information.</li>
          <li>Public X posts obtained through twitterapi.io, including post text, timestamps, account names, handles, profile information, engagement counts and media links. These can include reposts and quoted posts.</li>
        </ul>
      </section>
      <section>
        <h2>Why we process information and our legal bases</h2>
        <ul>
          <li><strong>Contract:</strong> creating and managing accounts, providing requested features, administering subscriptions and responding to service requests.</li>
          <li><strong>Legitimate interests:</strong> securing and maintaining the service, preventing misuse, handling enquiries and providing relevant football reporting, including processing public reporter posts. These interests must be balanced against individuals' rights.</li>
          <li><strong>Consent:</strong> optional analytics, advertising and personalization technologies, and optional marketing communications where consent is required.</li>
          <li><strong>Legal obligations:</strong> retaining required transaction records and responding to valid legal requests.</li>
        </ul>
        <p>You can object to processing based on legitimate interests and withdraw consent for future processing without affecting the lawfulness of processing before withdrawal.</p>
      </section>
      <section>
        <h2>Public posts and AI-generated reporting</h2>
        <p>We collect club-related posts for fan feeds and reporter context. Selected post text and source details are sent to OpenAI to extract relevant factual context. That context is supplied to Anthropic's Claude to help write match reports. Report generation is not intended to make decisions with legal or similarly significant effects about individuals.</p>
        <p>Reports are auto-generated and may contain errors. Reporter context is intended to be expressed in fresh wording, with source links where used. Public availability does not remove a person's data-protection rights. To request a correction, removal or objection, email us with the relevant post or page URL.</p>
      </section>
      <section>
        <h2>Providers and disclosures</h2>
        <p>Information is processed by infrastructure and service providers as needed to operate the site: Cloudflare and Railway for delivery/hosting, MongoDB Atlas for database storage, Stripe for payments, twitterapi.io for public posts, and OpenAI and Anthropic for report generation. Account passwords and payment-card details are not part of the match-report inputs.</p>
        <p>Where enabled and consented to, Google services provide analytics or advertising; a configured Meta Pixel may also process marketing events. These providers may act as independent controllers for some activities. See the <Link to="/cookie-policy">Cookie Policy</Link> and <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">Google's explanation of data use on partner sites</a>.</p>
        <p>We may disclose information where required by law, to protect rights and security, or in a business transfer subject to applicable safeguards. We do not sell account information.</p>
      </section>
      <section>
        <h2>International processing</h2>
        <p>Our providers may process information outside the UK, including in the United States. Where required by data-protection law, transfers must use an applicable adequacy arrangement or approved contractual safeguards. Contact us for information about the arrangements relevant to your data.</p>
      </section>
      <section>
        <h2>Retention and security</h2>
        <p>Raw tweet records and stored tweet copies in reports, drafts and AI debug traces have a 30-day retention limit measured from the original post date. Automated cleanup normally runs within a minute while the service is running and catches up after downtime. Article text, factual context and source-credit links are retained separately; historical database backups are not immediately rewritten by this cleanup.</p>
        <p>Account information is kept while needed to provide your account and resolve service issues. Transaction records may be retained after account closure where required for legal, tax or accounting purposes. Logs and backups may persist until their normal deletion or rotation. Contact us for a specific retention enquiry or deletion request.</p>
        <p>We use access controls and other technical safeguards, but no online service can guarantee absolute security.</p>
      </section>
      <section>
        <h2>Your rights and choices</h2>
        <p>Depending on applicable law, you may request access, correction, erasure, restriction or portability of your personal information, object to processing, or withdraw consent. Rights are subject to legal conditions; we may need to verify your identity before acting. Email contact@thereplay.app to make a request.</p>
        <p>Cookie choices are explained in our <Link to="/cookie-policy">Cookie Policy</Link>. Football content requires optional-cookie consent or an active subscription; subscribers can reject optional cookies. Withdrawal remains available, but pauses football access for non-paying visitors. Policies and account/subscription pages remain accessible without consent.</p>
        <p>You may also complain to the UK Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk</a>, or your local supervisory authority.</p>
      </section>
      <section>
        <h2>Children and policy changes</h2>
        <p>The Replay is not directed at children under 13. If you believe a child has provided personal information inappropriately, contact us. We will update this page when our practices change and provide additional notice where required.</p>
      </section>
    </LegalDocument>
  );
}
