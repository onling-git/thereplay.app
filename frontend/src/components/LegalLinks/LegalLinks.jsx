import React, { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LegalLinksContent } from './LegalLinksContent.mjs';
import './LegalLinks.css';

export default function LegalLinks() {
  const host = useRef(null);
  const navigate = useNavigate();
  const island = typeof document === 'undefined' ? null : document.getElementById('legal-links-island');
  useLayoutEffect(() => {
    if (!island || !host.current) return;
    host.current.appendChild(island);
    return () => { document.getElementById('legal-links-depot')?.appendChild(island); };
  }, [island]);
  const handleClick = event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`);
  };
  return <div ref={host} onClick={handleClick}>{!island && <LegalLinksContent />}</div>;
}
