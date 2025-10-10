'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import MaterialComparisonPage from '@/components/materials/MaterialComparisonPage';

export default function MaterialComparison() {
  return (
    <Layout title="물성/부식성 비교">
      <MaterialComparisonPage />
    </Layout>
  );
}