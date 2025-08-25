import React from 'react';
import './connection-notification.css';

// Import types from centralized location
import type { StatusNotificationProps } from '../data/webserial.interface';

const ConnectionNotification: React.FC<StatusNotificationProps> = ({
  message,
  type,
  role = 'status',
  'aria-live': ariaLive = 'polite',
}) => {
  // Early return if no message
  if (!message) return null;

  const getAriaLive = (): 'polite' | 'assertive' | 'off' => {
    // Use assertive for errors to immediately announce them
    if (type === 'error' || type === 'danger') {
      return 'assertive';
    }
    return ariaLive;
  };

  const getRole = (): string => {
    // Use alert role for errors/warnings for immediate attention
    if (
      (type === 'error' || type === 'danger' || type === 'warning') &&
      role === 'status'
    ) {
      return 'alert';
    }
    return role;
  };

  return (
    <div
      className='connection-notification'
      role={getRole()}
      aria-live={getAriaLive()}
      aria-atomic='true'
    >
      {message}
    </div>
  );
};

export default ConnectionNotification;
