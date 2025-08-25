import React from 'react';
import HelpIcon from '../assets/help.svg?react';
import FirmwareDownloadIcon from '../assets/firmware_download.svg?react';
import PurchaseIcon from '../assets/purchase.svg?react';
import CardComponent from './card-component';
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
    <CardComponent icon={HelpIcon} title='Support links'>
      <ul className='support-links'>{renderSupportLinks(supportLinks)}</ul>
    </CardComponent>
  );
}
