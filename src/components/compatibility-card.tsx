import React from 'react';

// Import types from centralized location
import type {
  CompatibilityCardProps,
  BrowserInfo,
} from '../data/webserial.interface';

const CompatibilityCard: React.FC<CompatibilityCardProps> = ({
  className = '',
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

  const getSupportedBrowsers = (): string[] => {
    return ['Chrome 89+', 'Edge 89+', 'Opera 75+'];
  };

  const getUnsupportedBrowsers = (): string[] => {
    return ['Firefox', 'Safari', 'Mobile browsers'];
  };

  const getStatusIcon = (): string => {
    return isSerialSupported ? '✅' : '❌';
  };

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

  const cardClassName = ['card-wrapper', className].filter(Boolean).join(' ');

  return (
    <div className={cardClassName}>
      <div className='card'>
        <div className='compatibility-status' role='status' aria-live='polite'>
          <span className='status-label'>Browser compatibility:</span>
          <span
            className={`status-label ${isSerialSupported ? 'supported' : 'not-supported'}`}
            aria-label={`Web Serial API is ${isSerialSupported ? 'supported' : 'not supported'} in your browser`}
          >
            {getStatusIcon()}{' '}
            {isSerialSupported ? 'Supported' : 'Not Supported'}
          </span>
        </div>

        {showDetails && (
          <>
            <p
              className='card__description'
              role='region'
              aria-label='Browser compatibility information'
            >
              {getRecommendation()}
            </p>

            <div className='browser-details'>
              <div className='browser-section'>
                <h3 className='browser-section__title'>
                  ✅ Supported Browsers:
                </h3>
                <ul className='browser-list' role='list'>
                  {getSupportedBrowsers().map((browser, index) => (
                    <li key={index} className='browser-list__item'>
                      <strong>{browser}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className='browser-section'>
                <h3 className='browser-section__title'>❌ Not Supported:</h3>
                <ul className='browser-list' role='list'>
                  {getUnsupportedBrowsers().map((browser, index) => (
                    <li key={index} className='browser-list__item'>
                      {browser}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {!isSerialSupported && (
              <div className='compatibility-warning' role='alert'>
                <strong>Action Required:</strong> To use this firmware updater,
                please download and install{' '}
                <a
                  href='https://www.google.com/chrome/'
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label='Download Google Chrome (opens in new tab)'
                >
                  Google Chrome
                </a>{' '}
                or{' '}
                <a
                  href='https://www.microsoft.com/edge'
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label='Download Microsoft Edge (opens in new tab)'
                >
                  Microsoft Edge
                </a>
                .
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CompatibilityCard;
