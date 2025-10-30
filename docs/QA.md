# Quality Assurance Test Plan

## Testing Framework
- **Manual Testing**: User interface and workflow validation
- **Database Integration**: Supabase schema compliance and performance
- **SMS Integration**: Twilio notification system testing
- **Performance**: Load testing for calendar views and real-time updates

## Existing Test Categories

### Authentication & Access Control
1. User login/logout functionality
2. Role-based access permissions (admin, manager, staff, vendor)
3. RLS policy enforcement

### Vehicle Management
1. Vehicle CRUD operations
2. Stock number validation and search
3. Vehicle status management

### Job Management
1. Job creation and assignment
2. Status progression validation
3. Time tracking and completion

### Vendor Operations
1. Vendor availability management
2. Capacity planning and scheduling
3. Performance tracking

### Notification System  
1. SMS template generation
2. Notification timing and delivery
3. Inbound SMS processing

## Calendar Hub Acceptance Tests

1) "S" focuses header search; typing an exact Stock binds vehicle in Create; partial shows stock-first suggestions.

2) Drag from Unassigned to a vendor lane → event saves, recolors; capacity respected.

3) Scheduling outside vendor_hours shows warning; Manager override allows save.

4) Drag/resize that overlaps same vehicle is blocked with a clear toast.

5) Move event → "changed" row appears in notification_outbox (sent by scheduler).

6) Mark Completed → pickup SMS enqueued; No-show auto at T+15m (if job start passed).

7) Vendor login sees only their jobs; cannot view others.

8) Agenda and exports show EST labels; DB stores UTC.

## Performance Benchmarks

### Calendar Loading
- Initial load: < 2 seconds for weekly view
- Date range switching: < 500ms
- Real-time updates: < 100ms latency

### Search Performance  
- Stock search: < 300ms response time
- Partial search: < 500ms for 20 results
- Debounced input: 300ms delay

### Database Operations
- Job creation: < 200ms
- Drag/drop save: < 300ms  
- SMS enqueue: < 100ms

## Browser Compatibility
- Chrome 90+
- Firefox 88+  
- Safari 14+
- Edge 90+

## Mobile Responsiveness
- Calendar grid adapts to mobile screens
- Touch-friendly drag and drop
- Responsive drawer and modal layouts

## Accessibility Compliance
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

## Security Testing
- RLS policy validation
- SQL injection prevention  
- XSS protection
- CSRF token validation

## Error Handling
- Network failure recovery
- Database constraint violations
- Invalid input validation
- User-friendly error messages