import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument from '../components/LegalDocument/LegalDocument';

export default function AttributionCopyrightPolicy() {
  return (
    <LegalDocument title="Attribution & Copyright Policy">
      <section>
        <h2>Independent football coverage</h2>
        <p>The Replay is an independent football service. We are not an official club, league, competition, publisher or social platform, and displaying their names or marks does not imply endorsement or affiliation.</p>
      </section>
      <section>
        <h2>Sources and ownership</h2>
        <ul>
          <li><strong>Match data:</strong> fixtures, scores, statistics and related football information are supplied through Sportmonks and other sources identified where relevant. Data may be delayed or incomplete; provider terms and database rights may apply.</li>
          <li><strong>Club and competition marks:</strong> badges, logos, names and trademarks belong to their respective owners and are used to identify the relevant teams and competitions. We do not claim ownership of them.</li>
          <li><strong>News and images:</strong> linked headlines, publisher material, photographs and other media remain the property of their respective rights holders. Follow source links to the original publisher. Credit is not a substitute for any permission required.</li>
          <li><strong>Social posts:</strong> public X posts are obtained through twitterapi.io. Fan feeds can display original text, profile information and links. Original authors and other rights holders retain their rights; use of a collection provider does not establish an endorsement or licence from X or the author.</li>
        </ul>
      </section>
      <section>
        <h2>Reporter context in automated reports</h2>
        <p>AI systems may use selected reporter posts as factual context alongside match data. They are instructed not to reproduce distinctive wording or imitate a reporter's style. Reports include a Match Sources credit and original-post link when the writer records material use of that source. This process is automated and does not guarantee perfect attribution or the absence of accidental overlap.</p>
        <p>Raw tweet records and stored copies are subject to our 30-day posting-date retention policy. Written articles and source links are retained separately. See the <Link to="/privacy-policy">Privacy Policy</Link> and the AI-accuracy disclaimer in our <Link to="/terms-of-service">Terms of Service</Link>.</p>
      </section>
      <section>
        <h2>Reusing material</h2>
        <p>Rights in The Replay's original site design, branding and other protectable material are reserved except where expressly licensed. We do not claim exclusive rights over facts, third-party works or material that is not protected by copyright. Please contact us about republication or commercial reuse; our permission cannot grant rights belonging to others. Nothing in this policy limits statutory exceptions.</p>
      </section>
      <section>
        <h2>Copyright, attribution and removal requests</h2>
        <p>If you believe material on The Replay infringes your rights, is wrongly attributed or should be removed, email <a href="mailto:contact@thereplay.app">contact@thereplay.app</a> with:</p>
        <ul>
          <li>The exact URL of the page or post concerned and identification of the disputed material.</li>
          <li>A link to the original work or an explanation of the rights you hold.</li>
          <li>Your name, contact details and whether you act for the rights holder.</li>
          <li>The correction, credit or removal you are requesting and any supporting details.</li>
        </ul>
        <p>We will review requests and may ask for clarification or evidence. Where appropriate, we will correct attribution, restrict access or remove material. Please do not send unnecessary sensitive information. Privacy and personal-data requests can be sent to the same address.</p>
      </section>
    </LegalDocument>
  );
}
