import React from 'react';

const h = React.createElement;

export function LegalLinksContent() {
  return h('div', { className: 'legal-links' },
    h('nav', { className: 'legal-links-row', 'aria-label': 'Policies' },
      h('a', { href: '/privacy-policy' }, 'Privacy Policy'),
      h('a', { href: '/cookie-policy' }, 'Cookie Policy'),
      h('a', { href: '/terms-of-service' }, 'Terms of Service'),
      h('a', { href: '/attribution-copyright-policy' }, 'Attribution & Copyright'),
      h('a', { href: 'mailto:contact@thereplay.app' }, 'Contact')
    ),
    h('nav', { className: 'legal-links-row', 'aria-label': 'Explore' },
      h('a', { href: '/teams' }, 'Teams')
    )
  );
}
