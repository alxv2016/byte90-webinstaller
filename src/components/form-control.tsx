import React from 'react';
import './form-control.css';

interface FormControlProps {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export default function FormControl({
  label,
  children,
  htmlFor,
  className = '',
}: FormControlProps) {
  return (
    <div className={`form-control ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      <div className='form-control__input-wrapper'>{children}</div>
    </div>
  );
}
