# Project Structure

```
rocket-aftermarket-tracker/
│
├── 📁 public/                          # Static assets and PWA configuration
│   ├── 🖼️ favicon.ico                 # Website icon
│   ├── 📱 manifest.json               # PWA manifest for mobile app-like experience
│   ├── 🤖 robots.txt                  # Search engine crawling instructions
│   ├── 🔀 _redirects                  # Netlify deployment redirects
│   └── 📁 assets/
│       └── 📁 images/
│           └── 🖼️ no_image.png       # Placeholder image for missing assets
│
├── 📁 src/                            # Main application source code
│   ├── 🚀 index.jsx                  # React app entry point
│   ├── 📱 App.jsx                     # Root application component
│   ├── 🛣️ Routes.jsx                 # Application routing configuration
│   │
│   ├── 📁 components/                 # Reusable UI components
│   │   ├── 🧩 AppIcon.jsx            # Lucide icon wrapper component
│   │   ├── 🖼️ AppImage.jsx           # Enhanced image component with lazy loading
│   │   ├── 🛡️ ErrorBoundary.jsx      # Error handling boundary
│   │   ├── 🔒 ProtectedRoute.jsx      # Authentication guard for routes
│   │   ├── ⬆️ ScrollToTop.jsx        # Auto-scroll utility for route changes
│   │   │
│   │   ├── 📁 layouts/               # Layout components
│   │   │   └── 🏗️ AppLayout.jsx      # Main application layout wrapper
│   │   │
│   │   ├── 📁 ui/                    # Core UI component library
│   │   │   ├── 🔗 index.js           # UI components barrel export
│   │   │   ├── 🧭 Navbar.jsx         # Application navigation bar
│   │   │   ├── 🔘 Button.jsx         # Styled button component
│   │   │   ├── 📝 Input.jsx          # Form input component
│   │   │   ├── ☑️ Checkbox.jsx       # Checkbox input component
│   │   │   ├── 📋 Select.jsx         # Dropdown select component
│   │   │   ├── 🎯 MultiSelect.jsx    # Multi-option select component
│   │   │   ├── 🔍 SearchableSelect.jsx # Searchable dropdown component
│   │   │   ├── 🎨 Icon.jsx           # Icon component wrapper
│   │   │   ├── 🔍 Search.jsx         # Search input component
│   │   │   ├── 🌐 Portal.jsx         # React portal for modals
│   │   │   ├── 📊 Sidebar.jsx        # Collapsible sidebar component
│   │   │   └── 🏠 Header.jsx         # Page header component
│   │   │
│   │   ├── 📁 common/                # Shared business components
│   │   │   ├── ⚡ QuickNavigation.jsx # Quick action navigation
│   │   │   ├── 🎛️ AdvancedFilters.jsx # Complex filtering system
│   │   │   ├── ✏️ InlineEditCell.jsx  # Editable table cells
│   │   │   ├── ⚠️ OverdueAlertBar.jsx # Overdue items warning
│   │   │   ├── 📊 ExportButton.jsx   # Data export functionality
│   │   │   ├── 🎨 ThemeSelector.jsx  # Theme switching component
│   │   │   ├── 📈 KpiRow.jsx         # Key performance indicators display
│   │   │   └── 🔗 QRCodeGenerator.jsx # QR code generation utility
│   │   │
│   │   └── 📁 mobile/               # Mobile-specific components
│   │       └── 📱 MobileComponents.jsx # Mobile UI adaptations
│   │
│   ├── 📁 pages/                     # Application screens and features
│   │   ├── ❌ NotFound.jsx           # 404 error page
│   │   │
│   │   ├── 📁 deals/                 # 💼 Deal Management System
│   │   │   ├── 📊 index.jsx          # Main deals dashboard and tracker
│   │   │   ├── 📝 DealForm.jsx       # Deal creation/editing form
│   │   │   ├── ➕ NewDeal.jsx        # New deal creation page
│   │   │   ├── ✏️ EditDeal.jsx       # Deal editing page
│   │   │   ├── ➕ NewDealModal.jsx   # Modal for creating deals
│   │   │   ├── 🎯 useDealForm.js     # Deal form state management hook
│   │   │   └── 📁 components/
│   │   │       ├── ✏️ EditDealModal.jsx # Modal for editing deals
│   │   │       └── ⚙️ LineItemServiceConfig.jsx # Line item configuration
│   │   │
│   │   ├── 📁 currently-active-appointments/ # 🔄 Active Jobs Management
│   │   │   ├── 📊 index.jsx          # Active appointments dashboard
│   │   │   └── 📁 components/
│   │   │       ├── 📋 AppointmentDetailPanel.jsx # Appointment details
│   │   │       ├── ⚡ AssignmentQuickPanel.jsx # Quick assignment tools
│   │   │       ├── 🔧 BulkOperationsPanel.jsx # Bulk actions interface
│   │   │       ├── 📈 PerformanceWidget.jsx # Performance metrics
│   │   │       ├── 🃏 AppointmentCard.jsx # Appointment display card
│   │   │       └── 🎛️ FilterControls.jsx # Filtering controls
│   │   │
│   │   ├── 📁 calendar-flow-management-center/ # 📅 Calendar & Scheduling
│   │   │   ├── 📊 index.jsx          # Calendar management interface
│   │   │   └── 📁 components/
│   │   │       ├── ⚡ QuickFilters.jsx # Quick filter options
│   │   │       ├── 🏗️ VendorLaneView.jsx # Vendor-specific views
│   │   │       ├── 📋 UnassignedQueue.jsx # Unassigned jobs queue
│   │   │       ├── 🗂️ JobDrawer.jsx   # Job details drawer
│   │   │       └── 🔄 RoundUpModal.jsx # Job completion modal
│   │   │
│   │   ├── 📁 advanced-business-intelligence-analytics/ # 📊 Business Analytics
│   │   │   ├── 📊 index.jsx          # Analytics dashboard
│   │   │   └── 📁 components/
│   │   │       ├── 🏢 VendorPerformanceTable.jsx # Vendor metrics
│   │   │       ├── 📈 MetricCard.jsx # KPI display cards
│   │   │       ├── 💼 DealAnalyticsWidget.jsx # Deal analytics
│   │   │       ├── 📦 ProductPerformanceMatrix.jsx # Product metrics
│   │   │       ├── 📈 SalesTrendsChart.jsx # Sales trend visualization
│   │   │       └── 🚗 VehicleTypeChart.jsx # Vehicle analytics
│   │   │
│   │   ├── 📁 claims-management-center/ # 🛡️ Claims Processing
│   │   │   ├── 📊 index.jsx          # Claims management interface
│   │   │   └── 📁 components/
│   │   │       ├── 📊 ClaimStatsWidget.jsx # Claims statistics
│   │   │       ├── ⚙️ ClaimProcessingModal.jsx # Claims processing
│   │   │       └── 👤 ClaimAssignmentModal.jsx # Claims assignment
│   │   │
│   │   ├── 📁 guest-claims-submission-form/ # 🌐 Public Claims Portal
│   │   │   └── 📊 index.jsx          # Public claims submission
│   │   │
│   │   ├── 📁 loaner-management-drawer/ # 🚗 Loaner Vehicle System
│   │   │   └── 📊 index.jsx          # Loaner management interface
│   │   │
│   │   ├── 📁 authentication-portal/ # 🔐 Authentication System
│   │   │   ├── 📊 index.jsx          # Authentication interface
│   │   │   └── 📁 components/
│   │   │       ├── ℹ️ SystemInfo.jsx  # System information display
│   │   │       ├── 🏢 BrandHeader.jsx # Company branding
│   │   │       ├── 🔑 LoginForm.jsx   # User login form
│   │   │       └── 🛡️ SecurityBadges.jsx # Security indicators
│   │   │
│   │   ├── 📁 admin/                 # ⚙️ Administrative Interface
│   │   │   └── 📊 index.jsx          # Admin dashboard
│   │   │
│   │   └── 📁 [legacy-pages]/        # 📁 Additional Feature Pages
│   │       ├── 📁 calendar-scheduling-center/
│   │       ├── 📁 kanban-status-board/
│   │       ├── 📁 executive-analytics-dashboard/
│   │       ├── 📁 vendor-operations-center/
│   │       ├── 📁 claims-analytics-dashboard/
│   │       ├── 📁 vehicle-detail-workstation/
│   │       ├── 📁 customer-claims-portal/
│   │       ├── 📁 customer-claims-submission-portal/
│   │       ├── 📁 photo-documentation-center/
│   │       ├── 📁 vendor-job-dashboard/
│   │       ├── 📁 business-intelligence-reports/
│   │       ├── 📁 administrative-configuration-center/
│   │       ├── 📁 calendar/
│   │       ├── 📁 sales-transaction-interface/
│   │       ├── 📁 vehicle-management-hub/
│   │       ├── 📁 sales-tracker/
│   │       └── 📁 vehicles/
│   │
│   ├── 📁 services/                  # 🛠️ Business Logic & API Services
│   │   ├── 🔧 authService.js         # Authentication & user management
│   │   ├── 💼 dealService.js         # Deal operations & business logic
│   │   ├── 👷 jobService.js          # Job management services
│   │   ├── 📅 calendarService.js     # Calendar & scheduling operations
│   │   ├── 📦 productService.js      # Product catalog management
│   │   ├── 🏢 vendorService.js       # Vendor relationship management
│   │   ├── 🚗 vehicleService.js      # Vehicle data management
│   │   ├── 📊 analyticsService.js    # Business analytics & reporting
│   │   ├── 🛡️ claimsService.js       # Claims processing services
│   │   ├── 📊 claimsAnalyticsService.js # Claims analytics
│   │   ├── 📈 salesTrackerService.js # Sales tracking & metrics
│   │   ├── 📋 kanbanService.js       # Kanban board operations
│   │   ├── 🔧 advancedFeaturesService.js # Advanced system features
│   │   ├── 📷 photoDocumentationService.js # Photo management
│   │   ├── 🔔 notificationService.js # Notification system
│   │   ├── 📋 dropdownService.js     # Dropdown data management
│   │   └── 🏥 healthService.js       # System health monitoring
│   │
│   ├── 📁 lib/                       # 🔧 Core Libraries & Utilities
│   │   ├── 🗄️ supabase.js            # Supabase client configuration
│   │   ├── 🗄️ supabaseClient.js      # Enhanced Supabase client
│   │   ├── 🗄️ supabaseServer.js      # Server-side Supabase operations
│   │   ├── ⏰ time.js                # Time manipulation utilities
│   │   └── 📅 ics.js                # Calendar event generation
│   │
│   ├── 📁 contexts/                  # ⚛️ React Context Providers
│   │   ├── 🔐 AuthContext.jsx        # Authentication state management
│   │   └── 🎨 ThemeContext.jsx       # Theme & styling context
│   │
│   ├── 📁 hooks/                     # 🎣 Custom React Hooks
│   │   ├── 📋 useDropdownData.js     # Dropdown data fetching hook
│   │   └── 📝 useLogger.js           # Logging & debugging hook
│   │
│   ├── 📁 utils/                     # 🛠️ Utility Functions
│   │   ├── 💼 dealMappers.js         # Deal data transformation
│   │   ├── 📋 lineItemsUtils.js      # Line item utilities
│   │   ├── 📋 lineItemUtils.jsx      # Line item React utilities
│   │   ├── 🔍 resizeObserverHelper.js # Resize observer utilities
│   │   ├── 📝 logger.js              # Application logging
│   │   └── 🎨 cn.js                  # CSS class name utilities
│   │
│   ├── 📁 styles/                    # 🎨 Styling & Themes
│   │   ├── 🌐 index.css              # Global application styles
│   │   ├── 🎨 tailwind.css           # Tailwind CSS imports
│   │   ├── 🎨 theme-neutral.css      # Neutral theme definitions
│   │   └── 🔧 util-neutral.css       # Utility classes
│   │
│   ├── 📁 config/                    # ⚙️ Configuration Files
│   │   └── 🎨 ui.js                  # UI component configurations
│   │
│   ├── 📁 api/                       # 🌐 API Integration Layer
│   │   └── 🏥 health.js              # Health check endpoints
│   │
│   └── 📁 tests/                     # 🧪 Test Suites
│       ├── 🧪 step8-create-edit-roundtrip.test.js
│       ├── 🧪 step9-calendar-fields-spot-check.test.js
│       ├── 🧪 step10-csv-export-kpi-check.test.js
│       ├── 🧪 step11-dropdown-verification.test.js
│       ├── 🧪 step12-interactive-controls.test.js
│       ├── 🧪 step13-persistence-verification.test.js
│       ├── 🧪 step14-edit-flow-verification.test.js
│       ├── 🧪 step15-calendar-linkage-verification.test.js
│       ├── 🧪 step16-deals-list-verification.test.jsx
│       ├── 🧪 step17-regression-guards.test.js
│       ├── 🧪 step18-test-ids-verification.test.jsx
│       ├── 🧪 step19-dropdown-edge-cases.test.js
│       ├── 🧪 step20-rls-multi-user-concurrency.test.js
│       ├── 🧪 step21-cancel-unsaved-changes-guard.test.js
│       └── 🧪 step22-calendar-linkage-uniqueness.test.js
│
├── 📁 supabase/                      # 🗄️ Database & Backend Configuration
│   ├── 📁 functions/                 # ☁️ Serverless Functions
│   │   ├── 📁 processOutbox/
│   │   │   └── 📄 index.ts           # SMS/notification processing
│   │   └── 📁 twilioInbound/
│   │       └── 📄 index.ts           # Twilio webhook handler
│   │
│   └── 📁 migrations/                # 🗄️ Database Schema Migrations
│       ├── 📄 20250922170950_automotive_aftermarket_system.sql
│       ├── 📄 20251225151200_fix_authentication_core_issues.sql
│       ├── 📄 20251223141000_fix_auth_demo_users.sql
│       └── 📄 [50+ additional migration files...]
│
├── 📁 docs/                          # 📚 Documentation
│   ├── 📄 ERD.md                     # Entity relationship diagrams
│   ├── 📄 QA.md                      # Quality assurance guidelines
│   ├── 📄 KNOWN_ISSUES.md            # Known system limitations
│   └── 📄 import_mapping.md          # Data import mappings
│
├── 📁 data/                          # 📊 Sample Data
│   └── 📄 aftermarket_sample.csv     # Sample automotive data
│
├── 📄 package.json                   # 📦 Dependencies & scripts
├── 📄 package-lock.json              # 🔒 Dependency lock file
├── 📄 .env                           # 🔐 Environment variables
├── 📄 index.html                     # 🌐 HTML entry point
├── 📄 jsconfig.json                  # ⚙️ JavaScript configuration
├── 📄 tailwind.config.js             # 🎨 Tailwind CSS configuration
├── 📄 postcss.config.js              # 🎨 PostCSS configuration
├── 📄 README.md                      # 📖 Project documentation
├── 📄 RUNBOOK.md                     # 🏃 Operational procedures
├── 📄 CHANGELOG.md                   # 📝 Version history
└── 📄 analysis_of_customer_display_issue.md # 🔍 Technical analysis

```

## Key Features

### 🏗️ **Architecture**
- **Frontend**: React 18 with functional components and hooks
- **Backend**: Supabase (PostgreSQL + Auth + Real-time + Storage)
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context + Custom hooks
- **Build Tool**: Vite for fast development and production builds

### 💼 **Core Business Modules**
- **Deal Management**: Complete sales lifecycle tracking
- **Calendar & Scheduling**: Advanced appointment management
- **Claims Processing**: Insurance and warranty claim handling
- **Analytics & Reporting**: Business intelligence and metrics
- **Vendor Management**: External service provider coordination
- **Authentication**: Role-based access control

### 🎨 **UI/UX Features**
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Component Library**: Comprehensive reusable UI components
- **Theme System**: Consistent design language and styling
- **Accessibility**: ARIA labels and keyboard navigation support

### 🔧 **Technical Features**
- **Real-time Updates**: Live data synchronization via Supabase
- **Offline Support**: Progressive Web App capabilities
- **Error Handling**: Comprehensive error boundaries and logging
- **Testing Suite**: Extensive automated testing coverage
- **Performance**: Optimized loading and rendering strategies