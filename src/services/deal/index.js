// src/services/deal/index.js
// Re-exports everything from the deal sub-modules

export {
  getOrgContext,
  getCapabilities,
  isRlsError,
  mapPermissionError,
  wrapDbError,
} from './dealHelpers.js'

export {
  mapFormToDb,
  mapDbDealToForm,
  normalizeDealTimes,
  toJobPartRows,
  computeEarliestTimeWindow,
} from './dealMappers.js'

export {
  upsertLoanerAssignment,
  markLoanerReturned,
  listLoanerAssignmentsForDrawer,
  listJobsNeedingLoanersForDrawer,
  getReturnedLoanerAssignmentsForJob,
  saveLoanerAssignment,
} from './dealLoaners.js'

export {
  getAllDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStatus,
  searchCustomers,
  findJobIdByJobNumber,
} from './dealCRUD.js'

// Back-compat default export (so both import styles work):
import { getAllDeals, getDeal, createDeal, updateDeal, deleteDeal, updateDealStatus, findJobIdByJobNumber } from './dealCRUD.js'

export const dealService = {
  getAllDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStatus,
  findJobIdByJobNumber,
}

export default dealService
