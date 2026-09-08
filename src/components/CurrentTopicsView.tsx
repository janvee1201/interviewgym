import React from 'react';
import { NavigationTab } from '../types';
import { AILandscapeView } from './AILandscapeView';

interface CurrentTopicsViewProps {
  onNavigate: (tab: NavigationTab, params?: Record<string, any>) => void;
}

/**
 * Replaces the former Current Affairs section with "AI Tools & Model Landscape"
 * focused specifically on AI/GenAI interview awareness.
 */
export const CurrentTopicsView: React.FC<CurrentTopicsViewProps> = ({ onNavigate }) => {
  return <AILandscapeView onNavigate={onNavigate} />;
};

export default CurrentTopicsView;
