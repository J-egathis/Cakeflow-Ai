import React from 'react';
import { AdminView } from './AdminView';
import { User } from '../types';

interface DashboardViewProps {
  user: User;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  return <AdminView {...props} />;
};

export default DashboardView;
