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
  logo_path: string | null;
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

/**
 * One exported certificate's metadata. The PDF/XLSX/XML themselves are never
 * uploaded — this is the record of what was exported, not the document.
 */
type RetencionHistorialRow = {
  id: string;
  company_id: string;
  liquidacion: string;
  liq_correl_dgi: string | null;
  emisor: string | null;
  cuit_agente: string;
  fecha_origen: string;
  /** numeric(18,2). PostgREST serializes it as a JSON number. */
  importe: number;
  contrato: string | null;
  source_filename: string | null;
  created_by: string;
  created_at: string;
  last_exported_at: string;
  export_count: number;
};

/** Identidad de negocio de un molino (agente de retención). Catálogo global. */
type MolinoRow = {
  id: string;
  nombre: string;
  created_by: string | null;
  created_at: string;
};

/** Un CUIT que retiene en nombre de un molino. N CUITs → 1 molino. */
type EmisorCuitRow = {
  cuit: string;
  molino_id: string;
  created_by: string | null;
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
        Update: { name?: string; logo_path?: string | null };
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
      retenciones: {
        Row: RetencionHistorialRow;
        /**
         * Writes go through the `save_retenciones` function, which is what
         * makes the upsert atomic and keeps UPDATE out of the public key's
         * reach. A direct insert is still allowed by RLS.
         */
        Insert: {
          company_id: string;
          liquidacion: string;
          liq_correl_dgi?: string | null;
          emisor?: string | null;
          cuit_agente: string;
          fecha_origen: string;
          importe: number | string;
          contrato?: string | null;
          source_filename?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'retenciones_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'retenciones_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      molinos: {
        Row: MolinoRow;
        Insert: { nombre: string };
        Update: { nombre?: string };
        Relationships: [];
      };
      emisor_cuits: {
        Row: EmisorCuitRow;
        Insert: { cuit: string; molino_id: string };
        Update: { molino_id?: string };
        Relationships: [
          {
            foreignKeyName: 'emisor_cuits_molino_id_fkey';
            columns: ['molino_id'];
            isOneToOne: false;
            referencedRelation: 'molinos';
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
    Views: {
      /** `cuit → nombre`: la resolución de identidad en una sola lectura. */
      emisor_por_cuit: {
        Row: { cuit: string; molino_id: string; nombre: string };
        Relationships: [];
      };
    };
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
      save_retenciones: {
        Args: { p_company: string; p_rows: Json };
        Returns: RetencionHistorialRow[];
      };
      invitation_by_token: {
        Args: { p_token: string };
        Returns: {
          email: string;
          role: string;
          company_name: string;
          company_slug: string;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
