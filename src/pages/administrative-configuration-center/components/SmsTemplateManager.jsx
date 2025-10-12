import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { advancedFeaturesService } from '../../../services/advancedFeaturesService';
import { useAuth } from '../../../contexts/AuthContext';

const SmsTemplateManager = ({ className = '' }) => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [error, setError] = useState('');
  const { userProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    template_type: 'job_status',
    subject: '',
    message_template: '',
    variables: [],
    is_active: true
  });

  const templateTypes = [
    { value: 'job_status', label: 'Job Status Update' },
    { value: 'overdue_alert', label: 'Overdue Alert' },
    { value: 'customer_notification', label: 'Customer Notification' },
    { value: 'vendor_assignment', label: 'Vendor Assignment' },
    { value: 'completion_notice', label: 'Completion Notice' }
  ];

  const commonVariables = [
    '{{customer_name}}',
    '{{vehicle_info}}',
    '{{job_number}}',
    '{{status}}',
    '{{due_date}}',
    '{{completion_date}}',
    '{{total_cost}}',
    '{{vendor_name}}',
    '{{contact_phone}}',
    '{{days_overdue}}'
  ];

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      let result = await advancedFeaturesService?.getSmsTemplates();
      
      if (result?.error) {
        setError(result?.error?.message);
      } else {
        setTemplates(result?.data);
        setError('');
      }
    } catch (err) {
      setError('Failed to load SMS templates');
      console.error('Error loading templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    try {
      let result;
      
      if (editingTemplate) {
        result = await advancedFeaturesService?.updateSmsTemplate(
          editingTemplate?.id, 
          formData
        );
      } else {
        result = await advancedFeaturesService?.createSmsTemplate(formData);
      }

      if (result?.error) {
        setError(result?.error?.message);
        return;
      }

      // Reload templates
      await loadTemplates();
      
      // Reset form
      setFormData({
        name: '',
        template_type: 'job_status',
        subject: '',
        message_template: '',
        variables: [],
        is_active: true
      });
      
      setShowCreateModal(false);
      setEditingTemplate(null);
      
    } catch (err) {
      setError(err?.message || 'Failed to save template');
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template?.name || '',
      template_type: template?.template_type || 'job_status',
      subject: template?.subject || '',
      message_template: template?.message_template || '',
      variables: template?.variables || [],
      is_active: template?.is_active !== false
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      let result = await advancedFeaturesService?.deleteSmsTemplate(id);
      
      if (result?.error) {
        setError(result?.error?.message);
      } else {
        await loadTemplates();
      }
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  const handleCancel = () => {
    setShowCreateModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      template_type: 'job_status',
      subject: '',
      message_template: '',
      variables: [],
      is_active: true
    });
    setError('');
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('message_template');
    const cursorPos = textarea?.selectionStart || 0;
    const textBefore = formData?.message_template?.substring(0, cursorPos);
    const textAfter = formData?.message_template?.substring(cursorPos);
    
    setFormData({
      ...formData,
      message_template: textBefore + variable + textAfter
    });
    
    // Focus back to textarea
    setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(cursorPos + variable?.length, cursorPos + variable?.length);
    }, 0);
  };

  const getTypeLabel = (type) => {
    const typeObj = templateTypes?.find(t => t?.value === type);
    return typeObj?.label || type;
  };

  if (!userProfile || !['admin', 'manager']?.includes(userProfile?.role)) {
    return (
      <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
        <div className="text-center text-muted-foreground">
          <Icon name="Lock" size={48} className="mx-auto mb-4" />
          <p>Access restricted to administrators and managers only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">SMS Template Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage automated SMS message templates with dynamic variables
          </p>
        </div>
        
        <Button
          onClick={() => setShowCreateModal(true)}
          iconName="Plus"
          iconPosition="left"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Create Template
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Icon name="AlertTriangle" size={20} className="text-red-600 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Templates List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3]?.map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-16 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      ) : templates?.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="MessageSquare" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">No Templates Yet</h4>
          <p className="text-muted-foreground mb-4">
            Create your first SMS template to automate customer communications.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            iconName="Plus"
            iconPosition="left"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates?.map((template) => (
            <div
              key={template?.id}
              className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-medium text-foreground">{template?.name}</h4>
                    
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {getTypeLabel(template?.template_type)}
                    </span>
                    
                    {!template?.is_active && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  {template?.subject && (
                    <div className="text-sm text-muted-foreground mb-2">
                      <strong>Subject:</strong> {template?.subject}
                    </div>
                  )}
                  
                  <div className="text-sm text-foreground bg-muted/30 p-2 rounded">
                    {template?.message_template}
                  </div>
                  
                  {template?.variables && template?.variables?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Variables:</div>
                      <div className="flex flex-wrap gap-1">
                        {template?.variables?.map((variable, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary font-mono"
                          >
                            {variable}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    onClick={() => handleEdit(template)}
                    variant="ghost"
                    size="sm"
                    iconName="Edit"
                    className="hover:bg-muted"
                  />
                  
                  <Button
                    onClick={() => handleDelete(template?.id)}
                    variant="ghost" 
                    size="sm"
                    iconName="Trash"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {editingTemplate ? 'Edit Template' : 'Create SMS Template'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Template Name
                  </label>
                  <Input
                    type="text"
                    value={formData?.name}
                    onChange={(e) => setFormData({ ...formData, name: e?.target?.value })}
                    placeholder="e.g., Job Status Update"
                    className="w-full"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Template Type
                  </label>
                  <Select
                    value={formData?.template_type}
                    onChange={(value) => setFormData({ ...formData, template_type: value })}
                    options={templateTypes}
                    className="w-full"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Subject (Optional)
                </label>
                <Input
                  type="text"
                  value={formData?.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e?.target?.value })}
                  placeholder="e.g., Service Update"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Message Template
                </label>
                <textarea
                  id="message_template"
                  value={formData?.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e?.target?.value })}
                  placeholder="Your message with variables"
                  className="w-full h-32 px-3 py-2 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    Click to insert common variables:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {commonVariables?.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData?.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e?.target?.checked })}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-ring focus:ring-2"
                />
                <span className="text-sm text-foreground">Template is active</span>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={handleCancel}
                  className="border-border hover:bg-muted"
                >
                  Cancel
                </Button>
                
                <Button 
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsTemplateManager;