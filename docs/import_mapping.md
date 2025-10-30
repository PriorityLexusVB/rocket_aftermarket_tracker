# CSV Import Mapping Guide

## Overview
The CSV import system supports importing vehicles, work orders, and appointments using a stock-first dedupe strategy. The system is case-insensitive and supports various header synonyms.

## Header Synonyms (Case-Insensitive)

### Vehicle Information
- **Stock Number**: `stock`, `stock_number`, `stock #`, `stock_num`
- **Year**: `year`, `vehicle_year`, `yr`
- **Make**: `make`, `vehicle_make`, `manufacturer`
- **Model**: `model`, `vehicle_model`
- **Color**: `color`, `vehicle_color`, `colour`
- **VIN**: `vin`, `vehicle_vin`, `vehicle_identification_number`

### Customer Information
- **Name**: `customer`, `customer_name`, `owner`, `owner_name`, `client`
- **Phone**: `phone`, `customer_phone`, `owner_phone`, `phone_number`
- **Email**: `email`, `customer_email`, `owner_email`, `email_address`

### Service Information
- **Date**: `date`, `service_date`, `appointment_date`, `scheduled_date`
- **Services**: `services`, `service_list`, `work_performed`, `description`
- **Status**: `status`, `job_status`, `appointment_status`
- **Priority**: `priority`, `urgency`, `importance`

### Processing Information
- **Processing Type**: `processing_type`, `vendor_type`, `work_type`
  - Maps: `IN HOUSE` → `in_house`, `VENDOR` → `vendor`, `INTERNAL` → `in_house`
- **Vendor**: `vendor`, `vendor_name`, `assigned_vendor`

## Stock-First Dedupe Logic

### Vehicle Deduplication
1. **Primary Key**: Stock number (exact match, case-insensitive)
2. **Conflict Resolution**: Last entry in CSV wins for vehicle details
3. **Missing Stock**: Creates vehicle with generated stock number

### Work Order Deduplication  
1. **Composite Key**: Stock + Date + Customer name
2. **Upsert Logic**: Updates existing work order if composite key matches
3. **New Orders**: Creates new work order for unique combinations

### Service Splitting
Services listed in a single field are split into multiple work items:
- **Delimiter**: Comma, semicolon, or pipe (`|`)
- **Example**: `"Brake Pads, Oil Change, Tire Rotation"` → 3 work items
- **Trimming**: Removes extra whitespace from each service

## Status Mapping

### Input → Database Status
- `pending`, `new`, `open` → `pending`
- `scheduled`, `booked`, `confirmed` → `scheduled`  
- `in progress`, `working`, `started` → `in_progress`
- `qc`, `quality check`, `review` → `quality_check`
- `done`, `finished`, `complete` → `completed`
- `canceled`, `cancelled`, `void` → `cancelled`

## Sample CSV Format

```csv
Stock,Year,Make,Model,Color,Customer,Phone,Date,Services,Status,Processing_Type
P12345,2018,Honda,Civic,Blue,John Smith,555-0123,2024-01-15,"Brake Pads, Oil Change",pending,IN HOUSE
P12346,2020,Toyota,Camry,White,Sarah Johnson,555-0456,2024-01-16,Tire Rotation,scheduled,VENDOR
P12347,2019,Ford,F-150,Black,Mike Davis,555-0789,2024-01-17,"Engine Tune-up, Air Filter",in progress,IN HOUSE
```

## Import Process

### Step 1: File Validation
- **Format**: CSV with headers in first row
- **Encoding**: UTF-8 supported
- **Size Limit**: 10MB maximum
- **Required Fields**: At minimum, one vehicle identifier (stock, VIN, or customer info)

### Step 2: Data Processing
1. **Header Mapping**: Case-insensitive matching to synonyms
2. **Stock Deduplication**: Groups records by stock number
3. **Vehicle Creation**: Upserts vehicles table
4. **Work Order Creation**: Links to vehicles by stock number
5. **Service Parsing**: Splits services into individual work items

### Step 3: Error Handling
- **Invalid Dates**: Skipped with warning
- **Missing Required Fields**: Row skipped with error log
- **Duplicate Stock + Date + Customer**: Updates existing record
- **Foreign Key Errors**: Logged but processing continues

## Import Results

### Success Metrics
- **Vehicles Imported**: Count of unique vehicles processed
- **Work Orders Created**: Count of work orders generated
- **Work Items Created**: Count of individual service items
- **Duplicates Resolved**: Count of updated existing records

### Error Reporting
- **Skipped Rows**: Count with reasons (missing data, invalid format)
- **Validation Errors**: Specific field validation failures
- **Database Errors**: Foreign key or constraint violations

## Best Practices

### Data Preparation
1. **Stock Numbers**: Ensure uniqueness and consistency
2. **Date Format**: Use YYYY-MM-DD or MM/DD/YYYY
3. **Phone Numbers**: Include area code, format consistently
4. **Service Descriptions**: Use consistent terminology

### Import Strategy
1. **Start Small**: Test with 10-20 records first
2. **Review Mapping**: Verify headers match expected synonyms
3. **Check Duplicates**: Review existing data before import
4. **Validate Results**: Spot-check imported records for accuracy

### Troubleshooting
1. **Header Issues**: Check for extra spaces or special characters
2. **Date Problems**: Verify date format consistency
3. **Stock Conflicts**: Review duplicate stock number handling
4. **Missing Links**: Ensure vehicle records exist before work orders