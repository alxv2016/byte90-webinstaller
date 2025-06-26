import React from 'react';

// Import types from centralized location
import type { StatusNotificationProps } from '../data/webserial.interface';

const StatusNotification: React.FC<StatusNotificationProps> = ({
  message,
  type,
  className = '',
  role = 'status',
  'aria-live': ariaLive = 'polite',
}) => {
  // Early return if no message
  if (!message) return null;

  const getStatusClass = (): string => {
    switch (type) {
      case 'success':
        return 'status-success';
      case 'warning':
        return 'status-warning';
      case 'error':
      case 'danger':
        return 'status-danger';
      case 'info':
        return 'status-info';
      default:
        return '';
    }
  };

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

  const combinedClassName = [
    'status-notification',
    'show',
    getStatusClass(),
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={combinedClassName}
      role={getRole()}
      aria-live={getAriaLive()}
      aria-atomic='true'
    >
      {message}
    </div>
  );
};

export default StatusNotification;
