// src/services/dealService.js
// Thin re-export wrapper for backward compatibility.
// All logic has been moved to src/services/deal/ sub-modules.

export {
  getOrgContext,
  getCapabilities,
  isRlsError,
  mapPermissionError,
  wrapDbError,
  mapFormToDb,
  mapDbDealToForm,
  normalizeDealTimes,
  toJobPartRows,
  computeEarliestTimeWindow,
  upsertLoanerAssignment,
  markLoanerReturned,
  listLoanerAssignmentsForDrawer,
  listJobsNeedingLoanersForDrawer,
  getReturnedLoanerAssignmentsForJob,
  saveLoanerAssignment,
  getAllDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStatus,
  searchCustomers,
  findJobIdByJobNumber,
  dealService,
} from './deal/index.js'

export { default } from './deal/index.js'
