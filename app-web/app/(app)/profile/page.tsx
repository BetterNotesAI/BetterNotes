import type { Metadata } from 'next';
import SettingsClient from '../settings/_components/SettingsClient';

export const metadata: Metadata = {
  title: 'Profile',
};

export default function ProfilePage() {
  return (
    <SettingsClient
      defaultSection="profile"
      title="Profile"
      subtitle="Edit your public profile details and visibility settings."
    />
  );
}
