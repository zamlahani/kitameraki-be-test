export type FormFieldType = 'text' | 'date' | 'datetime' | 'email';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  disabled: boolean;
}

export interface FormRow {
  id: string;
  fields: FormField[];
}

export interface FormSetting {
  id: string;
  organizationId: string;
  rows: FormRow[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_FORM_SETTING_ID = 'form-setting';
