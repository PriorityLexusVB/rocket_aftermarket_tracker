// src/pages/deals/NewDeal.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DealForm from './DealForm';
import { dealService } from '../../services/dealService';

export default function NewDeal() {
  const navigate = useNavigate();
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(formState) {
    setSaving(true);
    try {
      const created = await dealService?.createDeal(formState);
      navigate(`/deals/edit/${created?.id}`);
    } catch (e) {
      alert(e?.message || 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create Deal</h1>
        <p className="text-gray-600">Enter details below. You can edit later.</p>
      </div>
      <DealForm mode="create" onSubmit={onSubmit} onCancel={()=>navigate('/deals')} saving={saving} />
    </div>
  );
}