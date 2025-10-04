import React from 'react';

const KpiRow = ({ active, revenue, profit, margin, pending }) => {
  const Item = ({ label, value, suffix = "" }) => (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}{suffix}</div>
    </div>
  );
  
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Item label="Active" value={active} />
      <Item label="Revenue" value={`${revenue}`} />
      <Item label="Profit" value={`${profit}`} />
      <Item label="Margin" value={`${margin}`} suffix="%" />
      <Item label="Pending" value={pending} />
    </div>
  );
};

export default KpiRow;