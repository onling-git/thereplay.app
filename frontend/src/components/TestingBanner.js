import React from 'react';

const TestingBanner = () => {
  // Only show in testing mode
  if (process.env.REACT_APP_TESTING_MODE !== 'true') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: '#ff6b35',
      color: 'white',
      padding: '8px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      borderBottom: '2px solid #d63031'
    }}>
      🚧 TESTING ENVIRONMENT - This site is under development and not ready for public access 🚧
    </div>
  );
};

export default TestingBanner;