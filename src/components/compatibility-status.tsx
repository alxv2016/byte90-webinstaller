import React from 'react';

// Import types from centralized location
import type {
  CompatibilityCardProps,
  BrowserInfo,
} from '../data/webserial.interface';
import './compatibility-status.css';

const CompatibilityStatus: React.FC<CompatibilityCardProps> = ({
  showDetails = true,
}) => {
  // Check for Web Serial API support
  const isSerialSupported =
    typeof navigator !== 'undefined' && 'serial' in navigator;

  // Get browser information for better user guidance
  const getBrowserInfo = (): BrowserInfo => {
    if (typeof navigator === 'undefined') {
      return { name: 'Unknown', supported: false };
    }

    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      return { name: 'Chrome', supported: true };
    }
    if (userAgent.includes('Edg')) {
      return { name: 'Edge', supported: true };
    }
    if (userAgent.includes('Firefox')) {
      return { name: 'Firefox', supported: false };
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return { name: 'Safari', supported: false };
    }
    if (userAgent.includes('Opera')) {
      return { name: 'Opera', supported: true };
    }

    return { name: 'Unknown', supported: false };
  };

  const browserInfo = getBrowserInfo();

  const getRecommendation = (): string => {
    if (isSerialSupported) {
      return 'Your browser supports the Web Serial API. You can use this firmware updater.';
    }

    if (browserInfo.name === 'Firefox') {
      return 'Firefox does not support the Web Serial API. Please switch to Chrome or Edge.';
    }

    if (browserInfo.name === 'Safari') {
      return 'Safari does not support the Web Serial API. Please switch to Chrome or Edge.';
    }

    return 'Your browser does not support the Web Serial API. Please use Chrome or Edge.';
  };

  return (
    <>
      <div className='compatibility-status' role='status' aria-live='polite'>
        <div className='compatibility-status__header'>
          <span className='compatibility-status-title'>
            Browser compatibility
          </span>
          <span
            className='compatibility-status-label'
            aria-label={`Web Serial API is ${isSerialSupported ? 'supported' : 'not supported'} in your browser`}
          >
            {isSerialSupported ? 'Supported' : 'Not Supported'}
          </span>
        </div>
        <div className='compatibility-status__content'>
          {showDetails && (
            <p role='region' aria-label='Browser compatibility information'>
              {getRecommendation()}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default CompatibilityStatus;
