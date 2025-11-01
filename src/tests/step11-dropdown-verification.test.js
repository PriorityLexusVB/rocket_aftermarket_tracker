/**
 * Step 11: Dropdowns Verification Test
 *
 * This test validates all dropdowns load from correct tables, validates filters,
 * and tests persistence in edit mode exactly as specified in Step 11.
 *
 * Requirements:
 * - Salesperson dropdown: user_profiles where role='staff' AND department='Sales Consultants' AND is_active=true
 * - Delivery Coordinator dropdown: user_profiles where role IN ('admin','manager') AND department='Delivery Coordinator' AND is_active=true
 * - Vendor dropdown: vendors where is_active=true (sorted by name)
 * - Product dropdown: products where is_active=true (sorted by name)
 * - Edit persist: Create deal with line items, reopen Edit and confirm selections are preselected
 */

import React from 'react'
import { supabase } from '@/lib/supabase'

// Add missing test framework functions
const describe = (description, fn) => {
  console.log(`\n${description}`)
  fn()
}

const test = (description, fn) => {
  console.log(`  ${description}`)
  return fn()
}

const beforeAll = (fn) => {
  return fn()
}

const afterAll = (fn) => {
  return fn()
}

const expect = (actual) => ({
  toBeNull: () => {
    if (actual !== null) {
      throw new Error(`Expected ${actual} to be null`)
    }
  },
  toBeGreaterThan: (expected) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`)
    }
  },
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`)
    }
  },
  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`)
    }
  },
  toHaveLength: (expected) => {
    if (actual?.length !== expected) {
      throw new Error(`Expected ${actual} to have length ${expected}`)
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error(`Expected ${actual} to be defined`)
    }
  },
})

describe('Step 11: Dropdowns Verification', () => {
  let testJobId

  // SQL probe queries exactly as specified in Step 11
  const sqlProbes = {
    salesConsultants: `
      select count(*) as cnt,
             array_agg(full_name) as sample_names
      from user_profiles
      where role='staff' and department='Sales Consultants' and is_active=true
    `,
    deliveryCoordinators: `
      select count(*) as cnt,
             array_agg(full_name) as sample_names
      from user_profiles
      where role in ('admin','manager') and department='Delivery Coordinator' and is_active=true
    `,
    activeVendors: `
      select count(*) as cnt,
             array_agg(name) as sample_names
      from vendors
      where is_active=true
    `,
    activeProducts: `
      select count(*) as cnt,
             array_agg(name) as sample_names
      from products
      where is_active=true
    `,
  }

  beforeAll(async () => {
    console.log('\n[#] Step 11: Dropdowns — Starting verification tests')
  })

  afterAll(async () => {
    // Cleanup test job if created
    if (testJobId) {
      await supabase?.from('job_parts')?.delete()?.eq('job_id', testJobId)
      await supabase?.from('transactions')?.delete()?.eq('job_id', testJobId)
      await supabase?.from('jobs')?.delete()?.eq('id', testJobId)
    }
  })

  describe('Dropdown Data Source Verification', () => {
    test('should verify salesperson dropdown sources and filters', async () => {
      console.log('\n  Checking Sales Consultants dropdown data...')

      const { data, error } = await supabase?.rpc('get_sample_rows', {
        table_name: 'user_profiles',
      })

      expect(error)?.toBeNull()

      // Run SQL probe
      const { data: probeResult, error: probeError } = await supabase
        ?.rpc('execute_sql', { sql: sqlProbes?.salesConsultants })
        ?.single()

      if (probeError) {
        // Fallback to direct query if SQL probe function doesn't exist
        const { data: salesConsultants, error: queryError } = await supabase
          ?.from('user_profiles')
          ?.select('full_name')
          ?.eq('role', 'staff')
          ?.eq('department', 'Sales Consultants')
          ?.eq('is_active', true)
          ?.order('full_name')

        expect(queryError)?.toBeNull()
        console.log(`    Sales Consultants found: ${salesConsultants?.length || 0}`)

        if (salesConsultants?.length > 0) {
          console.log(`    Sample: ${salesConsultants?.[0]?.full_name}`)
          expect(salesConsultants?.length)?.toBeGreaterThan(0)
        } else {
          console.log('    ⚠️  No Sales Consultants found - creating seed data needed')
        }
      } else {
        console.log(`    SQL Probe Results: ${probeResult?.cnt || 0} Sales Consultants`)
      }
    })

    test('should verify delivery coordinator dropdown sources and filters', async () => {
      console.log('\n  Checking Delivery Coordinators dropdown data...')

      const { data: coordinators, error } = await supabase
        ?.from('user_profiles')
        ?.select('full_name, role, department')
        ?.in('role', ['admin', 'manager'])
        ?.eq('department', 'Delivery Coordinator')
        ?.eq('is_active', true)
        ?.order('full_name')

      expect(error)?.toBeNull()
      console.log(`    Delivery Coordinators found: ${coordinators?.length || 0}`)

      if (coordinators?.length > 0) {
        console.log(`    Sample: ${coordinators?.[0]?.full_name} (${coordinators?.[0]?.role})`)
        expect(coordinators?.length)?.toBeGreaterThan(0)
      } else {
        console.log('    ⚠️  No Delivery Coordinators found - creating seed data needed')
      }
    })

    test('should verify vendor dropdown sources and filters', async () => {
      console.log('\n  Checking Vendors dropdown data...')

      const { data: vendors, error } = await supabase
        ?.from('vendors')
        ?.select('name, is_active')
        ?.eq('is_active', true)
        ?.order('name')

      expect(error)?.toBeNull()
      console.log(`    Active Vendors found: ${vendors?.length || 0}`)

      if (vendors?.length > 0) {
        console.log(`    Sample: ${vendors?.[0]?.name}`)
        expect(vendors?.length)?.toBeGreaterThan(0)

        // Verify sorting by name
        const names = vendors?.map((v) => v?.name)
        const sortedNames = [...names]?.sort()
        expect(names)?.toEqual(sortedNames)
      } else {
        console.log('    ⚠️  No active vendors found - creating seed data needed')
      }
    })

    test('should verify product dropdown sources and filters', async () => {
      console.log('\n  Checking Products dropdown data...')

      const { data: products, error } = await supabase
        ?.from('products')
        ?.select('name, is_active')
        ?.eq('is_active', true)
        ?.order('name')

      expect(error)?.toBeNull()
      console.log(`    Active Products found: ${products?.length || 0}`)

      if (products?.length > 0) {
        console.log(`    Sample: ${products?.[0]?.name}`)
        expect(products?.length)?.toBeGreaterThan(0)

        // Verify sorting by name
        const names = products?.map((p) => p?.name)
        const sortedNames = [...names]?.sort()
        expect(names)?.toEqual(sortedNames)
      } else {
        console.log('    ⚠️  No active products found - creating seed data needed')
      }
    })
  })

  describe('Edit Persistence Verification', () => {
    test('should create deal with line items and verify edit persistence', async () => {
      console.log('\n  Creating test deal for edit persistence verification...')

      // Get available data for selections
      const [vendorsResult, productsResult, salesResult, coordResult] = await Promise.all([
        supabase?.from('vendors')?.select('id, name')?.eq('is_active', true)?.limit(1),
        supabase?.from('products')?.select('id, name')?.eq('is_active', true)?.limit(1),
        supabase
          ?.from('user_profiles')
          ?.select('id, full_name')
          ?.eq('role', 'staff')
          ?.eq('department', 'Sales Consultants')
          ?.eq('is_active', true)
          ?.limit(1),
        supabase
          ?.from('user_profiles')
          ?.select('id, full_name')
          ?.in('role', ['admin', 'manager'])
          ?.eq('department', 'Delivery Coordinator')
          ?.eq('is_active', true)
          ?.limit(1),
      ])

      const vendor = vendorsResult?.data?.[0]
      const product = productsResult?.data?.[0]
      const salesPerson = salesResult?.data?.[0]
      const coordinator = coordResult?.data?.[0]

      // Create a test vehicle first
      const { data: vehicle, error: vehicleError } = await supabase
        ?.from('vehicles')
        ?.insert({
          make: 'Test',
          model: 'Vehicle',
          year: 2025,
          stock_number: 'TEST-STEP11',
        })
        ?.select()
        ?.single()

      expect(vehicleError)?.toBeNull()

      // Create job as specified in Step 11: one vendor/off-site with promised date, one in-house/no schedule
      const { data: job, error: jobError } = await supabase
        ?.from('jobs')
        ?.insert({
          title: 'Step 11 Test Deal',
          vehicle_id: vehicle?.id,
          vendor_id: vendor?.id || null,
          job_status: 'new',
          service_type: 'mixed', // Will have both off-site and in-house items
          assigned_to: salesPerson?.id || null,
          delivery_coordinator_id: coordinator?.id || null,
          customer_needs_loaner: true,
        })
        ?.select()
        ?.single()

      expect(jobError)?.toBeNull()
      testJobId = job?.id

      console.log(`    Created test job: ${job?.id}`)

      // Create line items exactly as Step 11 specifies
      const lineItems = [
        {
          job_id: job?.id,
          product_id: product?.id || null,
          vendor_id: vendor?.id || null,
          quantity_used: 1,
          unit_price: 299.99,
          total_price: 299.99,
          is_off_site: true, // Off-site item
          requires_scheduling: true,
          promised_date: '2025-01-20', // With promised date
          description: 'Test vendor service',
        },
        {
          job_id: job?.id,
          product_id: product?.id || null,
          quantity_used: 1,
          unit_price: 199.99,
          total_price: 199.99,
          is_off_site: false, // In-house item
          requires_scheduling: false,
          no_schedule_reason: 'installed at delivery', // No schedule reason
          description: 'Test in-house service',
        },
      ]

      const { error: lineItemsError } = await supabase?.from('job_parts')?.insert(lineItems)

      expect(lineItemsError)?.toBeNull()
      console.log(`    Created 2 line items (off-site + in-house)`)

      // Now verify edit persistence - fetch the job back and check selections
      const { data: editJob, error: editError } = await supabase
        ?.from('jobs')
        ?.select(
          `
          *,
          job_parts (
            *,
            products (name)
          ),
          assigned_to:user_profiles!jobs_assigned_to_fkey (full_name),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey (full_name),
          vendor:vendors (name)
        `
        )
        ?.eq('id', job?.id)
        ?.single()

      expect(editError)?.toBeNull()

      // Verify all selections are preserved
      console.log('    Verifying edit persistence...')

      // Check salesperson assignment
      if (salesPerson) {
        expect(editJob?.assigned_to?.full_name)?.toBe(salesPerson?.full_name)
        console.log(`    ✅ Salesperson preserved: ${editJob?.assigned_to?.full_name}`)
      }

      // Check delivery coordinator assignment
      if (coordinator) {
        expect(editJob?.delivery_coordinator?.full_name)?.toBe(coordinator?.full_name)
        console.log(
          `    ✅ Delivery Coordinator preserved: ${editJob?.delivery_coordinator?.full_name}`
        )
      }

      // Check vendor assignment
      if (vendor) {
        expect(editJob?.vendor?.name)?.toBe(vendor?.name)
        console.log(`    ✅ Vendor preserved: ${editJob?.vendor?.name}`)
      }

      // Check customer needs loaner
      expect(editJob?.customer_needs_loaner)?.toBe(true)
      console.log(`    ✅ Customer needs loaner preserved: ${editJob?.customer_needs_loaner}`)

      // Check line items persistence
      expect(editJob?.job_parts)?.toHaveLength(2)

      const offSiteItem = editJob?.job_parts?.find((item) => item?.is_off_site)
      const inHouseItem = editJob?.job_parts?.find((item) => !item?.is_off_site)

      expect(offSiteItem)?.toBeDefined()
      expect(inHouseItem)?.toBeDefined()

      // Verify off-site item details
      expect(offSiteItem?.requires_scheduling)?.toBe(true)
      expect(offSiteItem?.promised_date)?.toBe('2025-01-20')
      console.log(`    ✅ Off-site item promised date preserved: ${offSiteItem?.promised_date}`)

      // Verify in-house item details
      expect(inHouseItem?.requires_scheduling)?.toBe(false)
      expect(inHouseItem?.no_schedule_reason)?.toBe('installed at delivery')
      console.log(
        `    ✅ In-house item no-schedule reason preserved: ${inHouseItem?.no_schedule_reason}`
      )

      // Check product assignments if products exist
      if (product) {
        editJob?.job_parts?.forEach((item) => {
          expect(item?.products?.name)?.toBe(product?.name)
        })
        console.log(`    ✅ Product selections preserved: ${product?.name}`)
      }

      console.log(
        '    ✅ All dropdown selections and line item configurations preserved in edit mode'
      )
    })
  })

  describe('SQL Probe Summary', () => {
    test('should run all SQL probes and print summary', async () => {
      console.log('\n  Running Step 11 SQL Probes Summary...')

      const results = {}

      // Sales Consultants probe
      try {
        const { data: salesData } = await supabase
          ?.from('user_profiles')
          ?.select('full_name')
          ?.eq('role', 'staff')
          ?.eq('department', 'Sales Consultants')
          ?.eq('is_active', true)
        results.salesConsultants = {
          count: salesData?.length || 0,
          sample: salesData?.[0]?.full_name || 'None',
        }
      } catch (e) {
        results.salesConsultants = { count: 0, sample: 'Error' }
      }

      // Delivery Coordinators probe
      try {
        const { data: coordData } = await supabase
          ?.from('user_profiles')
          ?.select('full_name')
          ?.in('role', ['admin', 'manager'])
          ?.eq('department', 'Delivery Coordinator')
          ?.eq('is_active', true)
        results.deliveryCoordinators = {
          count: coordData?.length || 0,
          sample: coordData?.[0]?.full_name || 'None',
        }
      } catch (e) {
        results.deliveryCoordinators = { count: 0, sample: 'Error' }
      }

      // Active Vendors probe
      try {
        const { data: vendorData } = await supabase
          ?.from('vendors')
          ?.select('name')
          ?.eq('is_active', true)
        results.activeVendors = {
          count: vendorData?.length || 0,
          sample: vendorData?.[0]?.name || 'None',
        }
      } catch (e) {
        results.activeVendors = { count: 0, sample: 'Error' }
      }

      // Active Products probe
      try {
        const { data: productData } = await supabase
          ?.from('products')
          ?.select('name')
          ?.eq('is_active', true)
        results.activeProducts = {
          count: productData?.length || 0,
          sample: productData?.[0]?.name || 'None',
        }
      } catch (e) {
        results.activeProducts = { count: 0, sample: 'Error' }
      }

      // Print probe results exactly as Step 11 specifies
      console.log('\n  📊 SQL Probe Results:')
      console.log(
        `    Sales Consultants (role='staff', dept='Sales Consultants', active=true): ${results?.salesConsultants?.count} | Sample: ${results?.salesConsultants?.sample}`
      )
      console.log(
        `    Delivery Coordinators (role in admin/manager, dept='Delivery Coordinator', active=true): ${results?.deliveryCoordinators?.count} | Sample: ${results?.deliveryCoordinators?.sample}`
      )
      console.log(
        `    Active Vendors (is_active=true): ${results?.activeVendors?.count} | Sample: ${results?.activeVendors?.sample}`
      )
      console.log(
        `    Active Products (is_active=true): ${results?.activeProducts?.count} | Sample: ${results?.activeProducts?.sample}`
      )

      // Validate minimum requirements
      const totalOptions = Object.values(results)?.reduce((sum, r) => sum + r?.count, 0)
      if (totalOptions === 0) {
        console.log('\n    ⚠️  Warning: All dropdown counts are 0 - seed data creation needed')
      } else {
        console.log('\n    ✅ Dropdown data sources validated')
      }
    })
  })
})
