import React from 'react';
import HelpIcon from '../assets/help.svg?react';
import FirmwareDownloadIcon from '../assets/firmware_download.svg?react';
import PurchaseIcon from '../assets/purchase.svg?react';
import './support-card.css';

interface SupportLink {
  text: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function SupportCard() {
  const supportLinks: SupportLink[] = [
    {
      text: 'Byte90 Firmware downloads',
      href: '#',
      icon: FirmwareDownloadIcon,
    },
    {
      text: 'Purchase Byte90 Series 2',
      href: '#',
      icon: PurchaseIcon,
    },
    {
      text: 'FAQ',
      href: '#',
      icon: HelpIcon,
    },
  ];

  const renderSupportLinks = (links: SupportLink[]) => {
    return links.map((link, index) => {
      const IconComponent = link.icon;
      return (
        <li key={index} className='support-link'>
          <a href={link.href || '#'} className='support-link__item'>
            {IconComponent && <IconComponent className='support-link__icon' />}
            <span>{link.text}</span>
          </a>
        </li>
      );
    });
  };

  return (
    <div className='support-card'>
      <div className='support-card__container'>
        <div className='support-card__header'>
          <HelpIcon className='support-card__icon' />
          <h2>Support links</h2>
        </div>
        <div className='support-card__content'>
          <ul className='support-links'>{renderSupportLinks(supportLinks)}</ul>
        </div>
      </div>
    </div>
  );
}
