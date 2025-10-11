'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import MaterialComparisonPage from '@/components/comparison/MaterialComparisonPage';

export default function MaterialComparison() {
  return (
    <Layout title="재질 물성 및 부식성 상세">
      <MaterialComparisonPage />
    </Layout>
  );
}