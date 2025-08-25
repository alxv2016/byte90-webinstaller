import React from 'react';
import './status-announcer.css';

interface StatusAnnouncerProps {
  label?: string;
  message: string;
  className?: string;
}

export default function StatusAnnouncer({
  label = 'Status',
  message,
  className = '',
}: StatusAnnouncerProps) {
  return (
    <div
      className={`status-announcer ${className}`}
      role='alert'
      aria-live='assertive'
    >
      <span className='status-announcer__label'>{label}</span>
      <span className='status-announcer__message'>{message}</span>
    </div>
  );
}
