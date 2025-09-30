import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';

const Sidebar = ({ isOpen = false, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [overdueJobsCount, setOverdueJobsCount] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    operations: true,
    management: false,
    reporting: false
  });

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    if (savedCollapsed) {
      setIsCollapsed(JSON.parse(savedCollapsed));
    }

    const savedExpandedSections = localStorage.getItem('sidebar-expanded-sections');
    if (savedExpandedSections) {
      setExpandedSections(JSON.parse(savedExpandedSections));
    }
  }, []);

  const toggleCollapsed = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newCollapsed));
  };

  const toggleSection = (sectionKey) => {
    const newExpandedSections = {
      ...expandedSections,
      [sectionKey]: !expandedSections?.[sectionKey]
    };
    setExpandedSections(newExpandedSections);
    localStorage.setItem('sidebar-expanded-sections', JSON.stringify(newExpandedSections));
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    if (searchQuery?.trim()) {
      if (searchQuery?.match(/^[A-Z0-9]{17}$/)) {
        navigate('/vehicle-detail-workstation');
      } else {
        navigate('/vendor-operations-center');
      }
      setSearchQuery('');
      if (onClose) onClose();
    }
  };

  const navigationSections = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'BarChart3',
      path: '/dashboard',
      description: 'Analytics Overview',
      standalone: true
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: 'Activity',
      description: 'Daily Tasks',
      isSection: true,
      items: [
        {
          id: 'sales-tracker',
          label: 'Sales Tracker',
          icon: 'TrendingUp',
          path: '/sales-tracker',
          description: 'Primary Workflow',
          isPrimary: true
        },
        {
          id: 'vehicles',
          label: 'Vehicle Management',
          icon: 'Car',
          path: '/vehicle-management-hub',
          description: 'Inventory Control',
          subItems: [
            { label: 'Vehicle Hub', path: '/vehicle-management-hub' },
            { label: 'Detail Workstation', path: '/vehicle-detail-workstation' }
          ]
        },
        {
          id: 'calendar',
          label: 'Calendar Scheduling',
          icon: 'Calendar',
          path: '/calendar-scheduling-center',
          description: 'Schedule Management'
        },
        {
          id: 'kanban',
          label: 'Kanban Board',
          icon: 'Columns',
          path: '/kanban-status-board',
          description: 'Status Tracking'
        }
      ]
    },
    {
      id: 'management',
      label: 'Management',
      icon: 'Settings',
      description: 'Admin Tasks',
      isSection: true,
      items: [
        {
          id: 'vendors',
          label: 'Vendor Operations',
          icon: 'Users',
          path: '/vendor-operations-center',
          description: 'Vendor Management',
          badge: overdueJobsCount > 0 ? overdueJobsCount : null,
          badgeColor: 'error',
          subItems: [
            { label: 'Operations Center', path: '/vendor-operations-center' },
            { label: 'Job Dashboard', path: '/vendor-job-dashboard' }
          ]
        },
        {
          id: 'sales-transactions',
          label: 'Sales Transactions',
          icon: 'DollarSign',
          path: '/sales-transaction-interface',
          description: 'Transaction Logging'
        },
        {
          id: 'configuration',
          label: 'Configuration',
          icon: 'Cog',
          path: '/administrative-configuration-center',
          description: 'System Settings'
        }
      ]
    },
    {
      id: 'reporting',
      label: 'Reporting',
      icon: 'FileText',
      description: 'Analysis & Documentation',
      isSection: true,
      items: [
        {
          id: 'business-intelligence',
          label: 'Business Intelligence',
          icon: 'PieChart',
          path: '/business-intelligence-reports',
          description: 'Advanced Analytics'
        },
        {
          id: 'photo-documentation',
          label: 'Photo Documentation',
          icon: 'Camera',
          path: '/photo-documentation-center',
          description: 'Visual Documentation'
        }
      ]
    }
  ];

  const isActiveRoute = (path, subItems = []) => {
    if (location?.pathname === path) return true;
    return subItems?.some(item => location?.pathname === item?.path);
  };

  const isActiveSection = (items = []) => {
    return items?.some(item => 
      isActiveRoute(item?.path, item?.subItems) || 
      item?.subItems?.some(subItem => location?.pathname === subItem?.path)
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-card border-r border-border shadow-elevation-2 z-50
        transition-all duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-16' : 'lg:w-60'}
        w-60
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <Icon name="Rocket" size={20} color="white" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground">
                    Rocket Aftermarket
                  </h1>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Tracker System
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                className="hidden lg:flex w-8 h-8"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Icon name={isCollapsed ? "ChevronRight" : "ChevronLeft"} size={16} />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="lg:hidden w-8 h-8"
                aria-label="Close sidebar"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
          </div>

          {/* Quick Search */}
          {!isCollapsed && (
            <div className="p-4 border-b border-border">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Icon 
                    name="Search" 
                    size={16} 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
                  />
                  <input
                    type="text"
                    placeholder="VIN or vendor name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e?.target?.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                  />
                </div>
              </form>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigationSections?.map((section) => {
              if (section?.standalone) {
                // Standalone items like Dashboard
                const isActive = isActiveRoute(section?.path);
                return (
                  <Button
                    key={section?.id}
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => handleNavigation(section?.path)}
                    className={`
                      w-full justify-start h-auto p-3 mb-3
                      ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                      transition-all duration-200
                    `}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <Icon 
                        name={section?.icon} 
                        size={20} 
                        className={`flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                      />
                      {!isCollapsed && (
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-sm font-medium truncate block">
                            {section?.label}
                          </span>
                          <p className={`text-xs truncate mt-0.5 ${
                            isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          }`}>
                            {section?.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </Button>
                );
              }

              // Section items
              const sectionActive = isActiveSection(section?.items);
              const sectionExpanded = expandedSections?.[section?.id];
              
              return (
                <div key={section?.id}>
                  {/* Section Header */}
                  {!isCollapsed && (
                    <Button
                      variant="ghost"
                      onClick={() => toggleSection(section?.id)}
                      className={`
                        w-full justify-start h-auto p-3 mb-2
                        ${sectionActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'}
                        transition-all duration-200
                      `}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3">
                          <Icon 
                            name={section?.icon} 
                            size={18} 
                            className={sectionActive ? 'text-accent-foreground' : 'text-muted-foreground'}
                          />
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider">
                              {section?.label}
                            </span>
                            <p className={`text-xs ${
                              sectionActive ? 'text-accent-foreground/80' : 'text-muted-foreground'
                            }`}>
                              {section?.description}
                            </p>
                          </div>
                        </div>
                        <Icon 
                          name={sectionExpanded ? "ChevronDown" : "ChevronRight"} 
                          size={14} 
                          className={sectionActive ? 'text-accent-foreground' : 'text-muted-foreground'}
                        />
                      </div>
                    </Button>
                  )}

                  {/* Section Items */}
                  {(sectionExpanded || isCollapsed) && (
                    <div className={`space-y-1 ${!isCollapsed ? 'ml-6' : ''}`}>
                      {section?.items?.map((item) => {
                        const isActive = isActiveRoute(item?.path, item?.subItems);
                        
                        return (
                          <div key={item?.id}>
                            <Button
                              variant={isActive ? "default" : "ghost"}
                              onClick={() => handleNavigation(item?.path)}
                              className={`
                                w-full justify-start h-auto p-3 relative
                                ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                                ${item?.isPrimary ? 'border-l-2 border-primary' : ''}
                                transition-all duration-200
                              `}
                            >
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <Icon 
                                  name={item?.icon} 
                                  size={20} 
                                  className={`flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                                />
                                
                                {!isCollapsed && (
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium truncate">
                                        {item?.label}
                                        {item?.isPrimary && (
                                          <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                                            Primary
                                          </span>
                                        )}
                                      </span>
                                      {item?.badge && (
                                        <span className={`
                                          ml-2 px-2 py-0.5 text-xs font-medium rounded-full
                                          ${item?.badgeColor === 'error' ? 'bg-error text-error-foreground' : 'bg-accent text-accent-foreground'}
                                        `}>
                                          {item?.badge}
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-xs truncate mt-0.5 ${
                                      isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                    }`}>
                                      {item?.description}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </Button>
                            
                            {/* Sub-items */}
                            {!isCollapsed && item?.subItems && isActive && (
                              <div className="ml-6 mt-1 space-y-1">
                                {item?.subItems?.map((subItem) => (
                                  <Button
                                    key={subItem?.path}
                                    variant="ghost"
                                    onClick={() => handleNavigation(subItem?.path)}
                                    className={`
                                      w-full justify-start h-8 px-3 text-xs
                                      ${location?.pathname === subItem?.path ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}
                                      transition-all duration-200
                                    `}
                                  >
                                    <Icon name="ChevronRight" size={14} className="mr-2" />
                                    {subItem?.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            {!isCollapsed ? (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => handleNavigation('/administrative-configuration-center')}
                  className="w-full justify-start h-10 px-3 text-sm"
                >
                  <Icon name="Settings" size={16} className="mr-3" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigation('/')}
                  className="w-full justify-start h-10 px-3 text-sm"
                >
                  <Icon name="LogOut" size={16} className="mr-3" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleNavigation('/administrative-configuration-center')}
                  className="w-full h-10"
                  aria-label="Settings"
                >
                  <Icon name="Settings" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleNavigation('/')}
                  className="w-full h-10"
                  aria-label="Sign Out"
                >
                  <Icon name="LogOut" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;