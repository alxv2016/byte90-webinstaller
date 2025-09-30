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
      href: 'https://github.com/alxv2016/Byte90-alxvlabs',
      icon: FirmwareDownloadIcon,
    },
    {
      text: 'Purchase Byte90 Series 2',
      href: 'https://labs.alxvtoronto.com/',
      icon: PurchaseIcon,
    },
    {
      text: 'FAQ',
      href: 'https://labs.alxvtoronto.com/pages/support',
      icon: HelpIcon,
    },
  ];

  const renderSupportLinks = (links: SupportLink[]) => {
    return links.map((link, index) => {
      const IconComponent = link.icon;
      return (
        <li key={index} className='support-link'>
          <a
            href={link.href || '#'}
            className='support-link__item'
            target='_blank'
            rel='noopener noreferrer'
          >
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
