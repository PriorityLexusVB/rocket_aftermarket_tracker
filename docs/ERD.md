# Entity Relationship Diagram

```mermaid
erDiagram
    user_profiles {
        uuid id PK
        text email UK
        text full_name
        user_role role
        boolean is_active
        uuid vendor_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    vendors {
        uuid id PK
        text name
        text phone
        text email
        text specialty
        numeric rating
        boolean is_active
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    vehicles {
        uuid id PK
        text stock_number UK
        text vin UK
        text make
        text model
        integer year
        text color
        text owner_name
        text owner_phone
        text owner_email
        vehicle_status vehicle_status
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    jobs {
        uuid id PK
        text job_number UK
        text title
        text description
        job_status job_status
        job_priority priority
        uuid vehicle_id FK
        uuid vendor_id FK
        uuid assigned_to FK
        uuid created_by FK
        timestamptz scheduled_start_time
        timestamptz scheduled_end_time
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at
        numeric estimated_cost
        numeric actual_cost
    }
    
    products {
        uuid id PK
        text name
        text description
        numeric price
        numeric cost
        uuid vendor_id FK
        uuid created_by FK
        timestamptz created_at
    }
    
    job_parts {
        uuid id PK
        uuid job_id FK
        uuid product_id FK
        integer quantity
        numeric unit_cost
        numeric unit_price
        timestamptz created_at
    }
    
    transactions {
        uuid id PK
        text transaction_number UK
        uuid job_id FK
        uuid vehicle_id FK
        text customer_name
        text customer_phone
        text customer_email
        numeric subtotal
        numeric tax_amount
        numeric total_amount
        transaction_status transaction_status
        uuid processed_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    communications {
        uuid id PK
        uuid job_id FK
        uuid vehicle_id FK
        communication_type communication_type
        text message
        text subject
        text recipient
        boolean is_successful
        text error_message
        uuid sent_by FK
        timestamptz sent_at
    }
    
    notification_outbox {
        uuid id PK
        text phone_e164
        text message_template
        jsonb variables
        timestamptz not_before
        timestamptz sent_at
        text twilio_sid
        text status
        text error_message
        timestamptz created_at
    }
    
    vendor_hours {
        uuid id PK
        uuid vendor_id FK
        integer day_of_week
        time start_time
        time end_time
        integer capacity_per_slot
        integer slot_duration_minutes
        boolean is_active
        timestamptz created_at
    }
    
    sms_opt_outs {
        text phone_e164 PK
        timestamptz opted_out_at
        text reason
    }

    %% Relationships
    user_profiles ||--o{ vendors : "created_by"
    user_profiles ||--o{ vehicles : "created_by"
    user_profiles ||--o{ jobs : "created_by"
    user_profiles ||--o{ jobs : "assigned_to"
    user_profiles ||--o{ products : "created_by"
    user_profiles ||--o{ transactions : "processed_by"
    user_profiles ||--o{ communications : "sent_by"
    
    vendors ||--o{ user_profiles : "vendor_id"
    vendors ||--o{ jobs : "vendor_id"
    vendors ||--o{ products : "vendor_id"
    vendors ||--o{ vendor_hours : "vendor_id"
    
    vehicles ||--o{ jobs : "vehicle_id"
    vehicles ||--o{ transactions : "vehicle_id"
    vehicles ||--o{ communications : "vehicle_id"
    
    jobs ||--o{ job_parts : "job_id"
    jobs ||--o{ transactions : "job_id"
    jobs ||--o{ communications : "job_id"
    
    products ||--o{ job_parts : "product_id"
```

## Key Relationships

### Core Entities
- **user_profiles**: Central user management with role-based access
- **vendors**: External service providers with capacity management
- **vehicles**: Customer vehicles with stock-first identification
- **jobs**: Work orders/appointments linking vehicles, vendors, and staff

### Business Logic
- **Stock-First Design**: vehicles.stock_number is primary lookup field
- **Job Lifecycle**: pending → scheduled → in_progress → quality_check → completed
- **Vendor Integration**: External vendors can be assigned jobs with time tracking
- **Communication Trail**: All SMS and other communications are logged

### SMS System
- **notification_outbox**: Queue for outbound SMS via Twilio edge functions
- **sms_opt_outs**: Customer preferences for SMS notifications
- **Auto-triggers**: Job status changes automatically enqueue SMS notifications

### Data Flow
1. **Vehicle Entry**: Stock number creates unique vehicle record
2. **Job Creation**: Work orders reference vehicles and can be assigned to vendors
3. **Scheduling**: Jobs get time slots and vendor assignments
4. **Communication**: Status changes trigger SMS via notification queue
5. **Completion**: Jobs close with transaction records and final communications