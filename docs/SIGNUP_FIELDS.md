# Sign Up Form Fields - SHM Chiefs Portal

## Overview

The Sign Up page collects comprehensive information about new chiefs registering with the SHM portal. All collected data is securely stored in Supabase.

## Required Fields

### 1. **Nom** (Last Name) *
- **Type**: Text input
- **Placeholder**: "Dupont"
- **Validation**: Must not be empty
- **Database Field**: `last_name`
- **Description**: The chief's last name

### 2. **Prénom** (First Name) *
- **Type**: Text input
- **Placeholder**: "Jean"
- **Validation**: Must not be empty
- **Database Field**: `first_name`
- **Description**: The chief's first name

### 3. **Email** *
- **Type**: Email input
- **Placeholder**: "chef@shm.org"
- **Validation**: Must be valid email format, must not be empty
- **Database Field**: `email`
- **Description**: Used for authentication and communications

### 4. **Date de naissance** (Date of Birth)
- **Type**: Date picker
- **Validation**: Optional
- **Database Field**: `date_of_birth`
- **Description**: Chief's date of birth (optional)

### 5. **CIN (Carte Nationale)** (National ID) *
- **Type**: Text input
- **Placeholder**: "Numéro CIN"
- **Validation**: Must not be empty, must be unique
- **Database Field**: `cin`
- **Description**: The national ID card number (Morocco)

### 6. **CAN (Code Carte)** (Card Code) *
- **Type**: Text input
- **Placeholder**: "Code CAN"
- **Validation**: Must not be empty
- **Database Field**: `can`
- **Description**: The code on the national ID card

### 7. **Téléphone** (Phone Number)
- **Type**: Tel input
- **Placeholder**: "+212 6XX XXX XXX"
- **Validation**: Optional
- **Database Field**: `phone`
- **Description**: Contact phone number

### 8. **Fonction/Responsabilité** (Role)
- **Type**: Select dropdown
- **Options**:
  - `member` - Membre (default)
  - `leader` - Chef de patrouille
  - `assistant` - Chef adjoint
  - `main` - Chef principal
- **Validation**: Must select a role
- **Database Field**: `role`
- **Description**: The chief's role within the SHM

### 9. **Mot de passe** (Password) *
- **Type**: Password input
- **Placeholder**: "••••••••"
- **Validation**: Minimum 8 characters, must not be empty
- **Database Field**: Handled by Supabase Auth
- **Description**: Secure password for account access

### 10. **Confirmer le mot de passe** (Confirm Password) *
- **Type**: Password input
- **Placeholder**: "••••••••"
- **Validation**: Must match password field
- **Database Field**: Not stored (validation only)
- **Description**: Password confirmation for security

## Database Storage

### Table: `chef_profiles`

All data is stored in the `chef_profiles` table with the following structure:

```sql
- id (UUID) - User's Supabase Auth ID
- email (VARCHAR) - Unique email
- first_name (VARCHAR) - First name
- last_name (VARCHAR) - Last name
- date_of_birth (DATE) - Date of birth
- cin (VARCHAR) - National ID (unique)
- can (VARCHAR) - Card code
- phone (VARCHAR) - Phone number
- role (VARCHAR) - Chief's role
- created_at (TIMESTAMP) - Registration timestamp
- updated_at (TIMESTAMP) - Last update timestamp
```

## Validation Rules

### Email
- Must be in valid email format
- Must be unique (no duplicates)
- Required field

### CIN (National ID)
- Must be unique (each chief has one ID)
- Required field
- Used for identity verification

### Password
- Minimum 8 characters
- Must be strong (handled by Supabase)
- Required field

### Confirmation Password
- Must exactly match the password field
- Required field

## Form Flow

1. **Pre-validation**: Client-side validation
2. **Supabase Auth**: User account creation
3. **Profile Creation**: Insert into `chef_profiles` table
4. **Success**: Redirect to login page
5. **Error Handling**: Display specific error messages

## Error Messages

- "Tous les champs requis doivent être remplis" - Required field missing
- "CIN et CAN sont obligatoires" - National ID fields missing
- "Les mots de passe ne correspondent pas" - Password mismatch
- "Le mot de passe doit contenir au moins 8 caractères" - Password too short
- Specific Supabase errors (email already exists, etc.)

## Example Values

```
Nom: Dupont
Prénom: Jean
Email: jean.dupont@example.com
Date de naissance: 1990-05-15
CIN: AB123456
CAN: 12345
Téléphone: +212612345678
Fonction: Chef principal
Mot de passe: SecurePassword123
```

## Security Considerations

- Passwords are never stored in plaintext (handled by Supabase Auth)
- CIN is unique to prevent duplicate registrations
- Email is verified through authentication process
- Row Level Security (RLS) ensures users can only access their own data
- All sensitive data is encrypted in transit (HTTPS)

## Next Steps After Registration

After successful sign-up:
1. User is redirected to login page
2. User logs in with email and password
3. User accesses dashboard
4. User can complete additional profile information
5. User can manage members, reports, sessions, and ideas
