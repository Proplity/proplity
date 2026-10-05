import type { Metadata } from 'next';
import { ProplityGuideClient } from './ProplityGuideClient';

export const metadata: Metadata = {
  title: 'Proplity Platform Guide — Complete Step-by-Step Role Guide',
  description:
    'Comprehensive visual walkthrough of every page, feature, role, and workflow in the Proplity property management platform with 100+ interactive screenshots.',
};

export default function ProplityGuidePage() {
  return <ProplityGuideClient />;
}
