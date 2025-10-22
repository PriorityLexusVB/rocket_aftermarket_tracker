export const toOption = (row, { labelKey = 'name', valueKey = 'id' } = {}) => ({
  id: row?.[valueKey],
  value: row?.[valueKey],
  label: row?.[labelKey] ?? row?.title ?? row?.name ?? String(row?.[valueKey] ?? ''),
  ...row,
})

export const toOptions = (rows, opts) =>
  Array.isArray(rows) ? rows.map((r) => toOption(r, opts)) : []
