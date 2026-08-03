export function buildUserAccountInvitePayload(form, dealerId) {
  return {
    email: form?.email,
    full_name: form?.full_name,
    role: form?.role,
    department: form?.department,
    phone: form?.phone,
    dealer_id: dealerId,
  }
}
