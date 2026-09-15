/**
 * Mirrors supabase/migrations (multitenant base). Keep in sync by hand, or
 * replace with `npx supabase gen types typescript --project-id <id>`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = 'owner' | 'member';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

type MembershipRow = {
  company_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
};

type InvitationRow = {
  id: string;
  company_id: string;
  email: string;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
};

type DescargasPresetRow = {
  id: string;
  company_id: string;
  name: string;
  config: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: { full_name?: string | null };
        Relationships: [];
      };
      companies: {
        Row: CompanyRow;
        Insert: never;
        Update: { name?: string };
        Relationships: [
          {
            foreignKeyName: 'companies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: MembershipRow;
        Insert: never;
        Update: { role?: MemberRole };
        Relationships: [
          {
            foreignKeyName: 'memberships_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: InvitationRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'invitations_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      descargas_presets: {
        Row: DescargasPresetRow;
        Insert: {
          company_id: string;
          name: string;
          config: Json;
        };
        Update: { name?: string; config?: Json };
        Relationships: [
          {
            foreignKeyName: 'descargas_presets_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_company: {
        Args: { p_name: string; p_slug: string };
        Returns: CompanyRow;
      };
      invite_member: {
        Args: { p_company: string; p_email: string; p_role?: MemberRole };
        Returns: InvitationRow;
      };
      accept_pending_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
