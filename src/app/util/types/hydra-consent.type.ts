  export interface HydraConsentRequest {
    challenge: string;
    client: {
      client_id: string;
      client_name?: string;
      [key: string]: unknown;
    };
    requested_scope: string[];
    requested_access_token_audience: string[];
    skip: boolean;
    subject: string;
    [key: string]: unknown;
  }
  
  export interface HydraConsentResponse {
    redirect_to: string;
  }