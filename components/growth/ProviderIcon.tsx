'use client';

import React from 'react';
import {
  AtSign,
  Briefcase,
  Camera,
  MessageCircle,
  Music2,
  Play,
  ThumbsUp,
} from 'lucide-react';
import { PROVIDERS } from '@/lib/growth/providers';
import type { SocialProvider } from '@/types/database';

interface ProviderIconProps {
  provider: SocialProvider;
  className?: string;
  colored?: boolean;
}

const ICONS: Record<SocialProvider, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  facebook: ThumbsUp,
  instagram: Camera,
  tiktok: Music2,
  linkedin: Briefcase,
  x: AtSign,
  threads: MessageCircle,
  youtube: Play,
};

export function ProviderIcon({
  provider,
  className = 'h-4 w-4',
  colored = true,
}: ProviderIconProps) {
  const Icon = ICONS[provider] || MessageCircle;
  return (
    <Icon
      className={className}
      style={colored ? { color: PROVIDERS[provider]?.color } : undefined}
    />
  );
}
