'use client';

import { useRouter } from 'next/navigation';
import { PropertyDiscovery } from '../../components/PropertyDiscovery';
import { navigateToPage } from '../navigateToPage';

export default function Page() {
  const router = useRouter();
  return <PropertyDiscovery onNavigate={(page) => navigateToPage(router, page)} />;
}
