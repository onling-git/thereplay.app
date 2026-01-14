// AdSense Footer Protection - Prevents AdSense ads from interfering with footer navigation
// This script continuously monitors and fixes AdSense iframe interference issues

const protectFooterFromAdSense = () => {
  // Function to apply protection styles to AdSense elements
  const applyAdSenseProtection = () => {
    // Target all potential AdSense iframe elements
    const adElements = document.querySelectorAll(`
      iframe[src*="googlesyndication"],
      iframe[src*="googleads"], 
      iframe[id*="aswift"],
      iframe[id*="google_ads"],
      [id*="google_ads_iframe"],
      .adsbygoogle,
      [data-google-container-id],
      div[id*="aswift_"],
      div[data-google-container-id]
    `);

    adElements.forEach(element => {
      // Get the bounding box of the element
      const rect = element.getBoundingClientRect();
      const footerHeight = 100; // Approximate footer height
      const viewportHeight = window.innerHeight;
      
      // Check if element is in the bottom area where footer appears
      if (rect.bottom > (viewportHeight - footerHeight)) {
        // Apply styles to prevent interference
        element.style.setProperty('z-index', '1', 'important');
        element.style.setProperty('position', 'relative', 'important');
        
        // For iframes, disable pointer events in footer area
        if (element.tagName === 'IFRAME') {
          element.style.setProperty('pointer-events', 'none', 'important');
          
          // Try to access iframe content if same-origin (likely won't work for Google ads, but worth trying)
          try {
            const iframeDoc = element.contentDocument || element.contentWindow.document;
            if (iframeDoc && iframeDoc.body) {
              iframeDoc.body.style.setProperty('pointer-events', 'none', 'important');
              iframeDoc.body.style.setProperty('z-index', '1', 'important');
            }
          } catch (e) {
            // Cross-origin iframe - expected for Google ads
            console.log('Cross-origin iframe detected (normal for AdSense)');
          }
        }
      } else {
        // Re-enable pointer events for ads not in footer area
        if (element.tagName === 'IFRAME') {
          element.style.removeProperty('pointer-events');
        }
      }
    });
  };

  // Function to ensure footer nav stays on top
  const ensureFooterOnTop = () => {
    const footerNav = document.querySelector('.footer-nav');
    if (footerNav) {
      footerNav.style.setProperty('z-index', '2147483647', 'important');
      footerNav.style.setProperty('position', 'fixed', 'important');
      footerNav.style.setProperty('pointer-events', 'auto', 'important');
      
      // Ensure all footer nav children are clickable
      const footerButtons = footerNav.querySelectorAll('.footer-navbar-icon-container');
      footerButtons.forEach(button => {
        button.style.setProperty('z-index', '2147483647', 'important');
        button.style.setProperty('pointer-events', 'auto', 'important');
        button.style.setProperty('position', 'relative', 'important');
      });
    }
  };

  // Run protection immediately
  applyAdSenseProtection();
  ensureFooterOnTop();

  // Set up observers and intervals to continuously monitor
  
  // MutationObserver to watch for DOM changes (new ads loading)
  const observer = new MutationObserver((mutations) => {
    let shouldReapply = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if any new nodes are AdSense related
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.tagName === 'IFRAME' || 
                node.id?.includes('aswift') || 
                node.id?.includes('google_ads') ||
                node.className?.includes('adsbygoogle')) {
              shouldReapply = true;
            }
          }
        });
      }
    });
    
    if (shouldReapply) {
      setTimeout(() => {
        applyAdSenseProtection();
        ensureFooterOnTop();
      }, 100);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also run on scroll and resize to handle dynamic positioning
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(applyAdSenseProtection, 100);
  });

  window.addEventListener('resize', () => {
    applyAdSenseProtection();
    ensureFooterOnTop();
  });

  // Periodic check every 2 seconds as a fallback
  setInterval(() => {
    applyAdSenseProtection();
    ensureFooterOnTop();
  }, 2000);

  // Additional check on page interactions
  ['click', 'touchstart', 'focus'].forEach(eventType => {
    document.addEventListener(eventType, () => {
      setTimeout(() => {
        applyAdSenseProtection();
        ensureFooterOnTop();
      }, 50);
    });
  });
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', protectFooterFromAdSense);
} else {
  protectFooterFromAdSense();
}

export default protectFooterFromAdSense;