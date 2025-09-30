import React, { useState, useEffect } from 'react';
        import { useForm } from 'react-hook-form';
        import Icon from '../../../components/AppIcon';
        import Button from '../../../components/ui/Button';
        import Input from '../../../components/ui/Input';
        import Select from '../../../components/ui/Select';

        const AddVehicleModal = ({ isOpen, onClose, onSubmit }) => {
          const [isSubmitting, setIsSubmitting] = useState(false);
          const [submitError, setSubmitError] = useState('');

          const {
            register,
            handleSubmit,
            reset,
            watch,
            formState: { errors, isValid }
          } = useForm({
            mode: 'onChange',
            defaultValues: {
              make: '',
              model: '',
              year: new Date()?.getFullYear(),
              stock_number: '',
              vin: '',
              color: '',
              mileage: '',
              license_plate: '',
              owner_name: '',
              owner_email: '',
              owner_phone: '',
              notes: '',
              vehicle_status: 'active'
            }
          });

          // Watch year to generate stock number suggestions
          const watchedYear = watch('year');
          const watchedMake = watch('make');

          const vehicleStatusOptions = [
            { value: 'active', label: 'Active' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'retired', label: 'Retired' },
            { value: 'sold', label: 'Sold' }
          ];

          const currentYear = new Date()?.getFullYear();
          const yearOptions = [];
          for (let year = currentYear + 1; year >= currentYear - 20; year--) {
            yearOptions?.push({ value: year, label: year?.toString() });
          }

          const commonMakes = [
            'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 
            'Dodge', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep', 'Kia', 
            'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Nissan', 'Ram', 'Subaru', 
            'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
          ];

          const makeOptions = [
            { value: '', label: 'Select Make' },
            ...commonMakes?.map(make => ({ value: make, label: make }))
          ];

          // Generate suggested stock number
          const generateStockNumber = () => {
            if (watchedMake && watchedYear) {
              const makePrefix = watchedMake?.substring(0, 2)?.toUpperCase();
              const yearSuffix = watchedYear?.toString()?.slice(-2);
              const randomNum = Math.floor(Math.random() * 999) + 1;
              return `${makePrefix}${yearSuffix}${randomNum?.toString()?.padStart(3, '0')}`;
            }
            return '';
          };

          const fillSuggestedStockNumber = () => {
            const suggested = generateStockNumber();
            if (suggested) {
              register('stock_number')?.onChange({ target: { value: suggested } });
            }
          };

          const handleFormSubmit = async (data) => {
            setIsSubmitting(true);
            setSubmitError('');

            try {
              // Clean up data - remove empty strings, convert numbers
              const cleanedData = {
                ...data,
                year: parseInt(data?.year),
                mileage: data?.mileage ? parseInt(data?.mileage) : null,
                // Remove empty strings
                vin: data?.vin?.trim() || null,
                stock_number: data?.stock_number?.trim() || null,
                color: data?.color?.trim() || null,
                license_plate: data?.license_plate?.trim() || null,
                owner_name: data?.owner_name?.trim() || null,
                owner_email: data?.owner_email?.trim() || null,
                owner_phone: data?.owner_phone?.trim() || null,
                notes: data?.notes?.trim() || null
              };

              await onSubmit(cleanedData);
              reset();
              onClose();
            } catch (error) {
              console.error('Error adding vehicle:', error);
              setSubmitError(error?.message || 'Failed to add vehicle. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          };

          const handleClose = () => {
            if (!isSubmitting) {
              reset();
              setSubmitError('');
              onClose();
            }
          };

          // Close modal on Escape key
          useEffect(() => {
            const handleEscape = (e) => {
              if (e?.key === 'Escape' && isOpen && !isSubmitting) {
                handleClose();
              }
            };

            if (isOpen) {
              document.addEventListener('keydown', handleEscape);
              document.body.style.overflow = 'hidden';
            }

            return () => {
              document.removeEventListener('keydown', handleEscape);
              document.body.style.overflow = 'unset';
            };
          }, [isOpen, isSubmitting]);

          if (!isOpen) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
              />
              {/* Modal */}
              <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                      <Icon name="Plus" size={20} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Add New Vehicle</h2>
                      <p className="text-sm text-muted-foreground">Enter vehicle details to add to inventory</p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    iconName="X"
                  />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(handleFormSubmit)} className="overflow-y-auto max-h-[calc(90vh-140px)]">
                  <div className="p-6 space-y-6">
                    {/* Error Message */}
                    {submitError && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Icon name="AlertCircle" size={16} className="text-destructive" />
                          <span className="text-sm text-destructive font-medium">Error</span>
                        </div>
                        <p className="text-sm text-destructive mt-1">{submitError}</p>
                      </div>
                    )}

                    {/* Vehicle Information */}
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-4">Vehicle Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Select
                          label="Make *"
                          options={makeOptions}
                          {...register('make', { required: 'Make is required' })}
                          error={errors?.make?.message}
                          required
                        />

                        <Input
                          label="Model *"
                          type="text"
                          placeholder="e.g., Civic, F-150, Camry"
                          {...register('model', { 
                            required: 'Model is required',
                            minLength: { value: 1, message: 'Model cannot be empty' }
                          })}
                          error={errors?.model?.message}
                          required
                        />

                        <Select
                          label="Year *"
                          options={yearOptions}
                          {...register('year', { 
                            required: 'Year is required',
                            valueAsNumber: true 
                          })}
                          error={errors?.year?.message}
                          required
                        />

                        <div className="relative">
                          <Input
                            label="Stock Number"
                            type="text"
                            placeholder="e.g., HO24001, FO24002"
                            {...register('stock_number')}
                            error={errors?.stock_number?.message}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={fillSuggestedStockNumber}
                            className="absolute right-2 top-8 text-xs"
                            disabled={!watchedMake || !watchedYear}
                          >
                            Auto
                          </Button>
                        </div>

                        <Input
                          label="VIN"
                          type="text"
                          placeholder="17-character VIN"
                          {...register('vin', {
                            minLength: { value: 17, message: 'VIN must be 17 characters' },
                            maxLength: { value: 17, message: 'VIN must be 17 characters' },
                            pattern: {
                              value: /^[A-HJ-NPR-Z0-9]{17}$/i,
                              message: 'Invalid VIN format'
                            }
                          })}
                          error={errors?.vin?.message}
                          maxLength={17}
                        />

                        <Input
                          label="Color"
                          type="text"
                          placeholder="e.g., Black, White, Silver"
                          {...register('color')}
                          error={errors?.color?.message}
                        />

                        <Input
                          label="Mileage"
                          type="number"
                          placeholder="e.g., 45000"
                          {...register('mileage', {
                            min: { value: 0, message: 'Mileage cannot be negative' },
                            max: { value: 999999, message: 'Mileage too high' }
                          })}
                          error={errors?.mileage?.message}
                        />

                        <Input
                          label="License Plate"
                          type="text"
                          placeholder="e.g., ABC-123"
                          {...register('license_plate')}
                          error={errors?.license_plate?.message}
                        />

                        <Select
                          label="Status"
                          options={vehicleStatusOptions}
                          {...register('vehicle_status')}
                          error={errors?.vehicle_status?.message}
                        />
                      </div>
                    </div>

                    {/* Owner Information */}
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-4">Owner Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input
                          label="Owner Name"
                          type="text"
                          placeholder="e.g., John Smith"
                          {...register('owner_name')}
                          error={errors?.owner_name?.message}
                        />

                        <Input
                          label="Owner Email"
                          type="email"
                          placeholder="e.g., owner@email.com"
                          {...register('owner_email', {
                            pattern: {
                              value: /^\S+@\S+$/,
                              message: 'Invalid email format'
                            }
                          })}
                          error={errors?.owner_email?.message}
                        />

                        <Input
                          label="Owner Phone"
                          type="tel"
                          placeholder="e.g., (555) 123-4567"
                          {...register('owner_phone')}
                          error={errors?.owner_phone?.message}
                        />
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                        placeholder="Any additional notes about the vehicle..."
                        {...register('notes')}
                      />
                      {errors?.notes && (
                        <p className="text-sm text-destructive mt-1">{errors?.notes?.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Icon name="Info" size={16} />
                      <span>* Required fields</span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!isValid || isSubmitting}
                        loading={isSubmitting}
                        iconName="Plus"
                        iconPosition="left"
                      >
                        Add Vehicle
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          );
        };

        export default AddVehicleModal;