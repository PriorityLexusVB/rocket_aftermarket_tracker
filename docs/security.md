# Security Configuration Guide

This document describes security configurations that must be set in the Supabase Dashboard (not via SQL migrations).

## Leaked Password Protection

### What is it?

Leaked password protection checks user passwords against known data breaches to prevent the use of compromised credentials. This is an important security feature for production environments.

### Status

- **Lint Warning**: `users_leaked_password_protection` on `auth.users`
- **Fix Location**: Supabase Dashboard (not SQL migration)

### How to Enable

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Scroll to **Security** section
3. Find **Leaked password protection**
4. Turn **ON** (recommended level: "Medium" or "High" for production)

### Recommended Settings by Environment

| Environment | Setting        | Notes                           |
| ----------- | -------------- | ------------------------------- |
| Development | Off or Low     | Reduces friction during testing |
| Staging     | Medium         | Matches production behavior     |
| Production  | Medium or High | Maximum security                |

### Reference

- [Supabase Auth Security Settings](https://supabase.com/docs/guides/auth/security)
- [Have I Been Pwned Integration](https://haveibeenpwned.com/)

## Other Dashboard Security Settings

### MFA (Multi-Factor Authentication)

- Consider enabling TOTP for admin users
- Available in: Auth → Settings → MFA

### Rate Limiting

- Configure appropriate rate limits for your traffic patterns
- Available in: Auth → Rate Limits

### Session Management

- Review session timeout settings
- Available in: Auth → Sessions

### Email Confirmations

- Consider requiring email confirmation for production
- Available in: Auth → Providers → Email

---

**Last Updated**: 2025-11-26  
**Related**: `docs/db-lint/README.md` - DB lint documentation
