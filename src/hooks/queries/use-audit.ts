// filepath: src/hooks/queries/use-audit.ts
import { useQuery } from '@tanstack/react-query';
import { localApiClient } from '@/lib/api-client';

export interface AuditLog {
  id: number;
  timestamp: string;
  user_id: string | null;
  username: string;
  user_role: string | null;
  module: string;
  action: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entity_name: string | null;
  entity_id: string | null;
  ip_address: string | null;
  endpoint: string | null;
  http_method: string | null;
  description: string;
  old_values: any | null;
  new_values: any | null;
  metadata_json: any | null;
}

export interface AuditLogsResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditLogsFilters {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  module?: string[];
  action?: string;
  severity?: string;
  search?: string;
}

export function useAuditLogs(filters: AuditLogsFilters) {
  return useQuery<AuditLogsResponse, Error>({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.action) params.append('action', filters.action);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.search) params.append('search', filters.search);
      
      if (filters.module && filters.module.length > 0) {
        filters.module.forEach(m => params.append('module', m));
      }

      const { data } = await localApiClient.get<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
      return data;
    },
    placeholderData: (previousData) => previousData, // keepPreviousData en TanStack Query v5
  });
}
