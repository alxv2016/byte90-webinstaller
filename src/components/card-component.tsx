import React from 'react';
import './card-component.css';

interface CardComponentProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  footerIcon?: React.ComponentType<{ className?: string }>;
  footerDescription?: string;
  muted?: boolean;
}

export default function CardComponent({
  icon: IconComponent,
  title,
  description,
  children,
  className = '',
  footerIcon: FooterIconComponent,
  footerDescription,
  muted = false,
}: CardComponentProps) {
  const hasFooter = FooterIconComponent || footerDescription;

  return (
    <div className={`card-component ${className}`}>
      <div
        className={`card-component__container ${hasFooter ? 'card-component__container--with-footer' : ''} ${muted ? 'card-component__container--muted' : ''}`}
      >
        {(IconComponent || title) && (
          <div className='card-component__header'>
            {IconComponent && (
              <IconComponent className='card-component__icon' />
            )}
            {title && <h2 className='card-component__title'>{title}</h2>}
          </div>
        )}

        <div className='card-component__content'>
          {description && (
            <p className='card-component__description'>{description}</p>
          )}
          {children}
        </div>
      </div>
      {hasFooter && (
        <div className='card-component__footer'>
          {FooterIconComponent && (
            <FooterIconComponent className='card-component__footer-icon' />
          )}
          {footerDescription && (
            <span className='card-component__footer-description'>
              {footerDescription}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
