export interface WhitelistEntry {
  id: string;
  email: string;
  createdAt: string;
}

export interface WhitelistSettings {
  enabled: boolean;
}

export interface AddWhitelistEntryRequest {
  email: string;
}
