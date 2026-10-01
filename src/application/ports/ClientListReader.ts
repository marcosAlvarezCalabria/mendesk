import type { ClientListItem } from "@/application/dtos/ClientListItem";

export type ClientListQuery = {
  page: number;
  pageSize: number;
  search?: string;
};

export type ClientListPage = {
  items: ClientListItem[];
  hasNextPage: boolean;
};

export interface ClientListReader {
  list(query: ClientListQuery): Promise<ClientListPage>;
}
